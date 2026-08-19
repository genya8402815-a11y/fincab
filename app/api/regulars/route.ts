import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

function toNum(v: string) {
  return parseFloat(String(v || '0').replace(/\s/g, '').replace(',', '.')) || 0;
}

export async function GET() {
  try {
    // B5 = заголовок, B6:F20 = данные
    // B=Название, C=Сумма, F=Оплачено (checkbox)
    const rows = await readRange("🔁 Регулярные!B5:F20");
    const items = rows
      .slice(1) // пропускаем заголовок (строка 5)
      .map((r, i) => ({
        rowIndex: 6 + i,          // реальный номер строки в таблице
        name:     r[0] ?? '',
        day:      r[1] ?? '',     // C = день месяца
        amount:   r[2] ?? '0',   // D = сумма ₽
        category: r[3] ?? '',    // E = категория
        paid:     String(r[4] ?? '').toUpperCase() === 'TRUE',
      }))
      .filter(item => item.name);

    const total      = items.reduce((s, i) => s + toNum(i.amount), 0);
    const unpaidAmt  = items.filter(i => !i.paid).reduce((s, i) => s + toNum(i.amount), 0);

    return NextResponse.json({ items, total, unpaidAmt });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения регулярных платежей' }, { status: 500 });
  }
}
