import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/_next/',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем публичные пути без проверки
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('fincab_auth');
  const validPassword = process.env.BASIC_AUTH_PASSWORD;

  if (authCookie?.value && validPassword && authCookie.value === validPassword) {
    return NextResponse.next();
  }

  // Не авторизован — редирект на страницу входа
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
