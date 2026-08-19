import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange, getSheets } from '@/lib/sheets';

const SHEET  = '⚙ Категории';
const SPREAD = process.env.GOOGLE_SPREADSHEET_ID!;

// A=расходы, B=доходы, C=долги, D=накопления
const COLS: Record<CatType, 'A' | 'B' | 'C' | 'D'> = {
  expense: 'A', income: 'B', debt: 'C', savings: 'D',
};

export type CatType = 'expense' | 'income' | 'debt' | 'savings';

const DEFAULTS: Record<CatType, string[]> = {
  expense:  ['Продукты', 'Транспорт', 'Кафе и рестораны', 'Связь', 'Развлечения', 'Подписки', 'Здоровье', 'Покупки', 'Вредные привычки', 'Подарки', 'Прочее'],
  income:   ['Зарплата', 'Фриланс', 'Подработка', 'Кешбэк', 'Прочее'],
  debt:     ['Кредит', 'Ипотека', 'Долг другу', 'Долг родственнику', 'Рассрочка', 'Прочее'],
  savings:  ['Подушка безопасности', 'Отпуск', 'Крупная покупка', 'Инвестиции', 'Прочее'],
};

async function readCol(col: string): Promise<string[]> {
  try {
    const rows = await readRange(`${SHEET}!${col}1:${col}100`);
    return rows.map(r => String(r[0] ?? '').trim()).filter(Boolean);
  } catch { return []; }
}

type CatsMap = Record<CatType, string[]>;

async function ensureSheet(): Promise<CatsMap> {
  try {
    await readRange(`${SHEET}!A1`); // проверяем что лист есть
  } catch {
    // Создаём лист
    const sheets = await getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREAD,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    // Записываем все дефолты
    for (const [type, col] of Object.entries(COLS) as [CatType, string][]) {
      const vals = DEFAULTS[type];
      await writeRange(`${SHEET}!${col}1:${col}${vals.length}`, vals.map(v => [v]));
    }
  }

  const [expense, income, debt, savings] = await Promise.all([
    readCol('A'), readCol('B'), readCol('C'), readCol('D'),
  ]);

  // Если какой-то столбец пустой — заполняем дефолтами
  const result: CatsMap = { expense, income, debt, savings };
  for (const type of Object.keys(COLS) as CatType[]) {
    if (result[type].length === 0) {
      const vals = DEFAULTS[type];
      await writeRange(`${SHEET}!${COLS[type]}1:${COLS[type]}${vals.length}`, vals.map(v => [v]));
      result[type] = [...vals];
    }
  }
  return result;
}

async function syncJournalValidation(cats: CatsMap) {
  const all = [...new Set([...cats.expense, ...cats.income, ...cats.debt, ...cats.savings])].filter(Boolean);
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
    const { name, type }: { name: string; type: CatType } = await req.json();
    if (!name?.trim() || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
    const trimmed = name.trim();
    const col = COLS[type];
    if (!col) return NextResponse.json({ error: 'invalid type' }, { status: 400 });

    const cats = await ensureSheet();
    const list = cats[type];

    if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json({ ok: true, action: 'already_exists', ...cats });
    }

    await writeRange(`${SHEET}!${col}${list.length + 1}`, [[trimmed]]);
    const updated: CatsMap = { ...cats, [type]: [...list, trimmed] };
    syncJournalValidation(updated).catch(e => console.warn('syncValidation:', e));

    return NextResponse.json({ ok: true, ...updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { name, type }: { name: string; type: CatType } = await req.json();
    if (!name?.trim() || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
    const col = COLS[type];

    const rows = await readRange(`${SHEET}!${col}1:${col}100`);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] ?? '').trim().toLowerCase() === name.trim().toLowerCase()) {
        await writeRange(`${SHEET}!${col}${i + 1}`, [['']] );
        const cats = await ensureSheet();
        syncJournalValidation(cats).catch(e => console.warn('syncValidation:', e));
        return NextResponse.json({ ok: true, ...cats });
      }
    }
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const cats = await ensureSheet();
    await syncJournalValidation(cats);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
