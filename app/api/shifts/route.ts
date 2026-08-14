import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Смены: строки с 5, B(дата) C(телефоны) D(аксессуары) E(техника) F(услуги) G(ЗП)
    const rows = await readRange('📅 Смены!B5:G200');
    const shifts = rows
      .filter(r => r[0])
      .map(r => ({
        date:        r[0] ?? '',
        phones:      r[1] ?? '0',
        accessories: r[2] ?? '0',
        tech:        r[3] ?? '0',
        services:    r[4] ?? '0',
        salary:      r[5] ?? '0',
      }));
    return NextResponse.json({ shifts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения смен' }, { status: 500 });
  }
}
