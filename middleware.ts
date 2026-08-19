import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/_next/',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем статику и служебные файлы без проверки
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Basic ')) {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    const validUser = process.env.BASIC_AUTH_USER;
    const validPass = process.env.BASIC_AUTH_PASSWORD;

    if (validUser && validPass && username === validUser && password === validPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="FinCab"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
