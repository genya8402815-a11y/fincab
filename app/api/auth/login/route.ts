import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const validPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!validPassword || password !== validPassword) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('fincab_auth', validPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 дней
    path: '/',
    sameSite: 'strict',
  });

  return response;
}
