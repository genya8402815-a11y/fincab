import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Затираем куку сессии — maxAge 0 удаляет её у клиента немедленно.
  response.cookies.set('fincab_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
    sameSite: 'strict',
  });
  return response;
}
