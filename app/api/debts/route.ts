import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Долги: B6:G22 (название, начало, внесено, остаток, день платежа, платёж/мес) — до 17 записей.
    // Раньше диапазон обрывался на E (Остаток) и не доходил до G (Платёж/мес),
    // из-за чего DTI на дашборде не мог считаться по настоящим платежам по долгам.
    const rows = await readRange('💳 Долги!B6:G22');
    const debts = rows
      .filter(r => r[0])
      .map(r => ({
        name:    r[0] ?? '',
        initial: r[1] ?? '0',
        paid:    r[2] ?? '0',
        left:    r[3] ?? '0',
        day:     r[4] ?? '',
        monthly: r[5] ?? '0',
      }));
    return NextResponse.json({ debts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения долгов' }, { status: 500 });
  }
}
