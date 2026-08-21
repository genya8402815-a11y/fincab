import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Полностью публичные пути
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const validPassword = process.env.BASIC_AUTH_PASSWORD;
  const validApiKey   = process.env.API_KEY;

  // X-API-Key — для iOS Shortcuts и внешних клиентов
  if (validApiKey) {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && apiKey === validApiKey) return NextResponse.next();
  }

  // Cookie-аутентификация для браузера
  const authCookie = request.cookies.get('fincab_auth');
  if (authCookie?.value && validPassword && authCookie.value === validPassword) {
    return NextResponse.next();
  }

  // API без авторизации → 401 JSON (не редирект, чтобы Shortcuts получал внятный ответ)
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
