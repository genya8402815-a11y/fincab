import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Журнал: строки с 5, B(дата) C(тип) D(сумма) E(категория) F(цель/долг) G(описание)
    const rows = await readRange('💰 Журнал операций!B5:G200');
    const entries = rows
      .filter(r => r[0])
      .map(r => ({
        date:        r[0] ?? '',
        type:        r[1] ?? '',
        amount:      r[2] ?? '',
        category:    r[3] ?? '',
        target:      r[4] ?? '',
        description: r[5] ?? '',
      }));
    return NextResponse.json({ entries });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения журнала' }, { status: 500 });
  }
}
