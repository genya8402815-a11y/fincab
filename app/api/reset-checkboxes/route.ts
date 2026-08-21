import { NextResponse } from 'next/server';
import { getSheets } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET не задан' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sheets = await getSheets();

    // Сбрасываем чекбоксы F6:F20 в FALSE
    const values = Array.from({ length: 15 }, () => [false]);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'🔁 Регулярные'!F6:F20",
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    return NextResponse.json({ success: true, message: 'Чекбоксы сброшены' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
