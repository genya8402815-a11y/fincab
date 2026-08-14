import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Дашборд: C2 (месяц), E2 (год), B4 (остаток), E4 (ЗП), H4 (долг), K4 (накопления)
    const header = await readRange('🏠 Дашборд!B2:K4');
    const month  = header[0]?.[2] ?? '';   // D2 = "Июн"
    const year   = header[0]?.[3] ?? '';   // E2 = "2026"
    const balance     = header[2]?.[0] ?? '0'; // B4
    const salary      = header[2]?.[3] ?? '0'; // E4
    const debt        = header[2]?.[6] ?? '0'; // H4
    const savings     = header[2]?.[9] ?? '0'; // K4

    // Трекер темпа: B89:H97
    const pace = await readRange('📊 Расчёт ЗП!B89:H97');

    return NextResponse.json({ month, year, balance, salary, debt, savings, pace });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения дашборда' }, { status: 500 });
  }
}
