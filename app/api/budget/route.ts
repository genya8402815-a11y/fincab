import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange, getSheets } from '@/lib/sheets';

const SHEET  = '💡 Бюджет';
const DATA   = `${SHEET}!A2:B50`;
const SPREAD = process.env.GOOGLE_SPREADSHEET_ID!;

// Создаёт лист если его нет, добавляет заголовки
async function ensureSheet() {
  try {
    await readRange(`${SHEET}!A1`);
  } catch {
    const sheets = await getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREAD,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await writeRange(`${SHEET}!A1:B1`, [['Категория', 'Бюджет (₽)']]);
  }
}

function toNum(v: string) {
  return parseFloat(String(v || '0').replace(/\s/g, '').replace(',', '.')) || 0;
}

export async function GET() {
  try {
    await ensureSheet();
    const rows = await readRange(DATA);
    const budgets: Record<string, number> = {};
    rows.forEach(r => {
      if (r[0] && r[1]) {
        const amt = toNum(r[1]);
        if (amt > 0) budgets[r[0]] = amt;
      }
    });
    return NextResponse.json({ budgets });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения бюджета' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSheet();
    const { category, amount } = await req.json();
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });

    const rows = await readRange(DATA);
    let rowNum = rows.length + 2; // по умолчанию — следующая пустая строка

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === category) { rowNum = i + 2; break; } // +2: заголовок в A1, данные с A2
    }

    const val = toNum(String(amount));
    if (val > 0) {
      await writeRange(`${SHEET}!A${rowNum}:B${rowNum}`, [[category, String(val)]]);
    } else {
      // Если 0 — очищаем строку (убираем лимит)
      await writeRange(`${SHEET}!A${rowNum}:B${rowNum}`, [['', '']]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 });
  }
}
