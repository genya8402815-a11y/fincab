import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Цели: B6:F25 (название, накоплено, нужно, осталось, %)
    const rows = await readRange('🎯 Цели!B6:G25');
    const goals = rows
      .filter(r => r[0])
      .map(r => ({
        name:    r[0] ?? '',
        saved:   r[1] ?? '0',
        need:    r[2] ?? '0',
        left:    r[3] ?? '0',
        percent: r[4] ?? '0',
        date:    r[5] ?? '',
      }));
    return NextResponse.json({ goals });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения целей' }, { status: 500 });
  }
}
