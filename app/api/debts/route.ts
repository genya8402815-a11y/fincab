import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Долги: B6:E22 (название, начало, внесено, остаток) — до 17 записей
    const rows = await readRange('💳 Долги!B6:E22');
    const debts = rows
      .filter(r => r[0])
      .map(r => ({
        name:    r[0] ?? '',
        initial: r[1] ?? '0',
        paid:    r[2] ?? '0',
        left:    r[3] ?? '0',
      }));
    return NextResponse.json({ debts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения долгов' }, { status: 500 });
  }
}
