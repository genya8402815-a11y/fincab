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
    const sheets = await getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREAD,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await writeRange(`${SHEET}!A1:A${DEFAULTS.length}`, DEFAULTS.map(c => [c]));
    return [...DEFAULTS];
  }
}

// Обновляет Data Validation столбца E (Категория) в журнале операций
// чтобы дропдаун ссылался на лист ⚙ Категории
async function syncJournalValidation() {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREAD });

  const journalSheet = meta.data.sheets?.find(
    s => s.properties?.title === '💰 Журнал операций'
  );
  if (!journalSheet?.properties?.sheetId == null) return;
  const sheetId = journalSheet!.properties!.sheetId!;

  // Столбец E = индекс 4 (B=1,C=2,D=3,E=4)
  // Строки с 5-й (индекс 4) по 2000-ю
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREAD,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 4,
              endRowIndex: 2000,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            rule: {
              condition: {
                type: 'ONE_OF_RANGE',
                values: [{ userEnteredValue: `='${SHEET}'!$A$1:$A$100` }],
              },
              strict: false,
              showCustomUi: true,
            },
          },
        },
      ],
    },
  });
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
    const updated = [...cats, trimmed];

    // Синхронизируем дропдаун в журнале (не блокируем ответ если упадёт)
    syncJournalValidation().catch(e => console.warn('syncValidation:', e));

    return NextResponse.json({ ok: true, categories: updated });
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

        syncJournalValidation().catch(e => console.warn('syncValidation:', e));

        return NextResponse.json({ ok: true, categories: remaining });
      }
    }
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/categories — принудительно синхронизирует дропдаун без изменения списка
export async function PUT() {
  try {
    await syncJournalValidation();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
