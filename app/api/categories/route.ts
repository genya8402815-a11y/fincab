import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange, getSheets } from '@/lib/sheets';

const SHEET  = '⚙ Категории';
const RANGE  = `${SHEET}!A1:A100`;
const SPREAD = process.env.GOOGLE_SPREADSHEET_ID!;

const DEFAULTS = ['Продукты', 'Транспорт', 'Кафе и рестораны', 'Связь', 'Развлечения', 'Подписки', 'Здоровье', 'Прочее'];

async function ensureSheet(): Promise<string[]> {
  try {
    const rows = await readRange(RANGE);
    const cats = rows.map(r => String(r[0] ?? '').trim()).filter(Boolean);
    return cats;
  } catch {
    // Лист не существует — создаём с дефолтными категориями
    const sheets = await getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREAD,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await writeRange(`${SHEET}!A1:A${DEFAULTS.length}`, DEFAULTS.map(c => [c]));
    return [...DEFAULTS];
  }
}

export async function GET() {
  try {
    const categories = await ensureSheet();
    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const trimmed = name.trim();

    const cats = await ensureSheet();
    if (cats.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json({ ok: true, action: 'already_exists' });
    }

    const nextRow = cats.length + 1;
    await writeRange(`${SHEET}!A${nextRow}`, [[trimmed]]);
    return NextResponse.json({ ok: true, categories: [...cats, trimmed] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const rows = await readRange(RANGE);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] ?? '').trim().toLowerCase() === name.trim().toLowerCase()) {
        await writeRange(`${SHEET}!A${i + 1}`, [['']] );
        const remaining = rows
          .map(r => String(r[0] ?? '').trim())
          .filter((c, idx) => c && idx !== i);
        return NextResponse.json({ ok: true, categories: remaining });
      }
    }
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
