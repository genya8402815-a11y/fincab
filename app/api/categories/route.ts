import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange, getSheets } from '@/lib/sheets';

const SHEET  = '⚙ Категории';
const SPREAD = process.env.GOOGLE_SPREADSHEET_ID!;

const DEFAULT_EXPENSE = ['Продукты', 'Транспорт', 'Кафе и рестораны', 'Связь', 'Развлечения', 'Подписки', 'Здоровье', 'Покупки', 'Вредные привычки', 'Подарки', 'Прочее'];
const DEFAULT_INCOME  = ['Зарплата', 'Фриланс', 'Подработка', 'Кешбэк', 'Прочее'];

async function readCol(col: 'A' | 'B'): Promise<string[]> {
  const rows = await readRange(`${SHEET}!${col}1:${col}100`);
  return rows.map(r => String(r[0] ?? '').trim()).filter(Boolean);
}

async function ensureSheet(): Promise<{ expense: string[]; income: string[] }> {
  try {
    const [expense, income] = await Promise.all([readCol('A'), readCol('B')]);
    return { expense, income };
  } catch {
    const sheets = await getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREAD,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await writeRange(`${SHEET}!A1:A${DEFAULT_EXPENSE.length}`, DEFAULT_EXPENSE.map(c => [c]));
    await writeRange(`${SHEET}!B1:B${DEFAULT_INCOME.length}`,  DEFAULT_INCOME.map(c => [c]));
    return { expense: [...DEFAULT_EXPENSE], income: [...DEFAULT_INCOME] };
  }
}

// Обновляет Data Validation столбца E журнала — объединённый список всех категорий
async function syncJournalValidation(expense: string[], income: string[]) {
  const all = [...new Set([...expense, ...income])].filter(Boolean);
  if (all.length === 0) return;

  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREAD });
  const journalSheet = meta.data.sheets?.find(s => s.properties?.title === '💰 Журнал операций');
  if (!journalSheet?.properties?.sheetId == null) return;
  const sheetId = journalSheet!.properties!.sheetId!;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREAD,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: { sheetId, startRowIndex: 4, endRowIndex: 2000, startColumnIndex: 4, endColumnIndex: 5 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: all.map(v => ({ userEnteredValue: v })),
            },
            strict: false,
            showCustomUi: true,
          },
        },
      }],
    },
  });
}

export async function GET() {
  try {
    const cats = await ensureSheet();
    return NextResponse.json(cats);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, type } = await req.json(); // type: 'expense' | 'income'
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const trimmed = name.trim();
    const col = type === 'income' ? 'B' : 'A';

    const cats = await ensureSheet();
    const list = type === 'income' ? cats.income : cats.expense;

    if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json({ ok: true, action: 'already_exists', ...cats });
    }

    await writeRange(`${SHEET}!${col}${list.length + 1}`, [[trimmed]]);
    const updated = { ...cats, [type === 'income' ? 'income' : 'expense']: [...list, trimmed] };
    syncJournalValidation(updated.expense, updated.income).catch(e => console.warn('syncValidation:', e));

    return NextResponse.json({ ok: true, ...updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { name, type } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const col = type === 'income' ? 'B' : 'A';

    const rows = await readRange(`${SHEET}!${col}1:${col}100`);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] ?? '').trim().toLowerCase() === name.trim().toLowerCase()) {
        await writeRange(`${SHEET}!${col}${i + 1}`, [['']] );
        const remaining = rows.map(r => String(r[0] ?? '').trim()).filter((c, idx) => c && idx !== i);
        const cats = await ensureSheet(); // перечитываем обе колонки
        syncJournalValidation(cats.expense, cats.income).catch(e => console.warn('syncValidation:', e));
        return NextResponse.json({ ok: true, ...cats });
      }
    }
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT — принудительная синхронизация дропдауна в Sheets
export async function PUT() {
  try {
    const cats = await ensureSheet();
    await syncJournalValidation(cats.expense, cats.income);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
