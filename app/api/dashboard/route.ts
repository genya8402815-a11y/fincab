import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { DASHBOARD, RANGES, cell } from '@/lib/sheetRanges';

export async function GET() {
  try {
    const header = await readRange(DASHBOARD.range);
    const C = DASHBOARD.cells;

    const pace = await readRange(RANGES.PACE_TRACKER);

    return NextResponse.json({
      month:   cell(header, C.MONTH,   ''),
      year:    cell(header, C.YEAR,    ''),
      balance: cell(header, C.BALANCE, '0'),
      salary:  cell(header, C.SALARY,  '0'),
      debt:    cell(header, C.DEBT,    '0'),
      savings: cell(header, C.SAVINGS, '0'),
      pace,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения дашборда' }, { status: 500 });
  }
}
