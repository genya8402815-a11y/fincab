import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { verifySessionToken } from '@/lib/session';

// ИСПРАВЛЕНИЕ (22.08.2026): rate limit раньше жил в обычной переменной (Map) —
// на Vercel Edge Runtime это ненадёжно: разные запросы могут попадать в разные
// "холодные" инстансы функции, каждый со своей отдельной памятью, и счётчик
// не всегда накапливался (подтверждено живым тестом — 7 неудачных попыток
// логина подряд не показали ограничение). Теперь счётчик хранится в Upstash
// Redis — общий для всех инстансов, настоящая гарантия лимита.
//
// Если переменные ещё не настроены в Vercel (Storage → Marketplace →
// Upstash for Redis) — работаем в режиме "открыто": лимит не применяется,
// но сайт не падает. То же самое — если Redis временно недоступен:
// приоритет отдаём доступности сайта, а не строгости лимита.
// (имена переменных — с префиксом UPSTASH_REDIS_REST_, так задано при
// подключении интеграции в Vercel)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

const redis = REDIS_URL && REDIS_TOKEN
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null;

const RL_MAX = 60;
const RL_WINDOW_S = 60;

const LOGIN_RL_MAX = 5;
const LOGIN_RL_WINDOW_S = 60;

async function checkRL(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!redis) return true; // Redis ещё не подключён — не блокируем
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count <= max;
  } catch {
    return true; // сбой Redis — не роняем сайт из-за лимитера
  }
}

// Пути без авторизации вообще
const PUBLIC_PATHS = [
  '/login',
  '/api/cron/',           // Vercel Cron — используют CRON_SECRET
  '/api/cache/version',   // дёргается из Apps Script (onEdit/бот), не из браузера — свой CRON_SECRET внутри роута
  '/_next/',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  // Логин — публичный путь (пароля ещё нет), но со строгим лимитом попыток
  if (pathname.startsWith('/api/auth/')) {
    if (!(await checkRL(`rl:login:${ip}`, LOGIN_RL_MAX, LOGIN_RL_WINDOW_S))) {
      return NextResponse.json({ error: 'Слишком много попыток входа, попробуйте через минуту' }, { status: 429 });
    }
    return NextResponse.next();
  }

  // Полностью публичные пути
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rate limiting — только для остальных API-запросов
  if (pathname.startsWith('/api/')) {
    if (!(await checkRL(`rl:api:${ip}`, RL_MAX, RL_WINDOW_S))) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }
  }

  const validApiKey = process.env.API_KEY;

  // X-API-Key — для iOS Shortcuts: заголовок ИЛИ query-параметр ?k=...
  if (validApiKey) {
    const headerKey = request.headers.get('x-api-key');
    const queryKey  = request.nextUrl.searchParams.get('k');
    if ((headerKey && headerKey === validApiKey) ||
        (queryKey  && queryKey  === validApiKey)) {
      return NextResponse.next();
    }
  }

  // Cookie-аутентификация — проверяем подписанный UUID-токен
  const token = request.cookies.get('fincab_auth')?.value ?? '';
  if (token && await verifySessionToken(token)) {
    return NextResponse.next();
  }

  // API без авторизации → 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Страница без авторизации → редирект на логин
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
