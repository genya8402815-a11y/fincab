import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { DASHBOARD, RANGES, cell } from '@/lib/sheetRanges';

export async function GET() {
  try {
    const header = await readRange(DASHBOARD.range);
    const C = DASHBOARD.cells;

    const pace = await readRange(RANGES.PACE_TRACKER);

    // P1 #51: план по зарплате (обязательные / накопления / личные) — для сверки
    // с лимитами по категориям на странице «Бюджет». Сбой чтения не критичен.
    let salarySplit = { mandatory: '0', savings: '0', personal: '0' };
    try {
      const sp = await readRange(RANGES.SALARY_SPLIT);
      salarySplit = {
        mandatory: String(sp[0]?.[0] ?? '0'),
        savings:   String(sp[1]?.[0] ?? '0'),
        personal:  String(sp[2]?.[0] ?? '0'),
      };
    } catch { /* оставляем нули */ }

    // #77: прогноз «до зарплаты» берём готовым из листа (J12:J15), чтобы сайт и
    // таблица показывали одно и то же. null — если чтение не удалось (сайт посчитает сам).
    let forecast: { ahead: string; free: string; perDay: string } | null = null;
    try {
      const f = await readRange(RANGES.FORECAST);
      forecast = {
        ahead:  String(f[1]?.[0] ?? '0'),
        free:   String(f[2]?.[0] ?? '0'),
        perDay: String(f[3]?.[0] ?? '0'),
      };
    } catch { /* fallback на старый расчёт */ }

    return NextResponse.json({
      salarySplit,
      forecast,
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
