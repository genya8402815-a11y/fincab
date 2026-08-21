import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { DASHBOARD, cell } from '@/lib/sheetRanges';

export async function GET() {
  try {
    const header  = await readRange(DASHBOARD.range);
    const balance = cell(header, DASHBOARD.cells.BALANCE);
    return new Response(balance, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
