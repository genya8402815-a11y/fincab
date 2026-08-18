import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    const dash = await readRange('🏠 Дашборд!B2:K30');
    const nastroyki = await readRange('⚙️ Настройки!B1:G60');
    return NextResponse.json({ dash, nastroyki });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
