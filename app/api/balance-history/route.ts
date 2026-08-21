import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { RANGES } from '@/lib/sheetRanges';

export async function GET() {
  try {
    const rows = await readRange(RANGES.HISTORY);
    const history = rows
      .filter(r => r[0] && r[1])
      .map(r => ({ month: r[0], balance: parseFloat(String(r[1]).replace(/\s/g, '').replace(',', '.')) || 0 }))
      .sort((a, b) => {
        // Сортируем по дате: MM.YYYY
        const [am, ay] = a.month.split('.');
        const [bm, by] = b.month.split('.');
        return (parseInt(ay) * 12 + parseInt(am)) - (parseInt(by) * 12 + parseInt(bm));
      });
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
