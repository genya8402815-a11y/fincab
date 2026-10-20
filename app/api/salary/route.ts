import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { RANGES } from '@/lib/sheetRanges';

export async function GET() {
  try {
    // Трекер темпа — единый диапазон из sheetRanges (раньше здесь был зашит
    // B89:H97, а сводка читалась из пустой строки 87 — из-за этого «Прогресс месяца»
    // показывал 0 смен, а часть строк трекера обрезалась).
    const pace = await readRange(RANGES.PACE_TRACKER);

    // Первая строка диапазона — сводка по сменам:
    // B: «Смен в графике:» C: число, D: «Отработано:» E: число, F: «Осталось смен:» G: число
    const s = pace[0] ?? [];
    return NextResponse.json({
      scheduled: s[1] ?? '0',
      worked:    s[3] ?? '0',
      remaining: s[5] ?? '0',
      pace,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения зарплаты' }, { status: 500 });
  }
}
