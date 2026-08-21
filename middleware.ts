import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/session';

// Rate limiting: 60 req/min per IP (per Edge instance)
const rlMap = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 60;
const RL_WINDOW = 60_000;

function checkRL(ip: string): boolean {
  const now = Date.now();
  const e = rlMap.get(ip);
  if (!e || now > e.resetAt) { rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW }); return true; }
  if (e.count >= RL_MAX) return false;
  e.count++;
  return true;
}

// Пути без авторизации вообще
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',   // Роут входа — должен быть публичным
  '/api/cron/',   // Vercel Cron — используют CRON_SECRET
  '/_next/',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Полностью публичные пути
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rate limiting — только для API-запросов
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
    if (!checkRL(ip)) {
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
