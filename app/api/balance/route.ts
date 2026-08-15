import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    const header = await readRange('🏠 Дашборд!B2:K4');
    const balance  = header[2]?.[0] ?? '0';
    const savings  = header[2]?.[9] ?? '0';
    const debt     = header[2]?.[6] ?? '0';
    return new NextResponse(balance, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
