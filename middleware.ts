import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/session';

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
