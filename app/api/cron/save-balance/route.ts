import { NextRequest, NextResponse } from 'next/server';
import { readRange, getSheets } from '@/lib/sheets';
import { DASHBOARD, RANGES, SHEET, cell } from '@/lib/sheetRanges';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sheets = await getSheets();

    // 1. Создаём лист "📈 История" если не существует
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET.HISTORY } } }] },
      });
    } catch { /* лист уже существует */ }

    // 2. Читаем текущий баланс
    const header = await readRange(DASHBOARD.range);
    const balance = cell(header, DASHBOARD.cells.BALANCE);

    // 3. Определяем текущий месяц (МСК = UTC+3)
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = now.getUTCFullYear();
    const monthKey = `${mm}.${yyyy}`;

    // 4. Проверяем — уже записан этот месяц?
    let existing: string[][] = [];
    try { existing = await readRange(RANGES.HISTORY); } catch { /* пустой лист */ }
    if (existing.some(r => r[0] === monthKey)) {
      return NextResponse.json({ ok: true, skipped: true, month: monthKey });
    }

    // 5. Дописываем строку
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.HISTORY,
      valueInputOption: 'RAW',
      requestBody: { values: [[monthKey, balance]] },
    });

    return NextResponse.json({ ok: true, month: monthKey, balance });
  } catch (e) {
    console.error('[save-balance]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
