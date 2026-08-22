import { google, sheets_v4 } from 'googleapis';
import { SHEET } from '@/lib/sheetRanges';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// ─── Приватные хелперы ────────────────────────────────────────────────────────

/**
 * Возвращает числовой sheetId листа по его имени.
 * Нужен для batchUpdate-запросов (copyPaste, deleteDimension и т.д.)
 */
async function getSheetId(
  sheets: sheets_v4.Sheets,
  sheetName: string,
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId ?? null;
  if (sheetId === null) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheetId;
}

/**
 * Копирует формулы из sourceRow в destRow через Sheets API copyPaste.
 *
 * Надёжнее regex-замены: Google Sheets сам адаптирует все относительные ссылки,
 * включая формулы с несколькими строками или перекрёстными ссылками.
 *
 * @param startCol - 0-indexed (A=0, B=1, G=6, H=7, …)
 * @param endCol   - 0-indexed, не включительно
 */
async function copyRowFormulas(
  sheets: sheets_v4.Sheets,
  sheetId: number,
  sourceRow: number,  // 1-indexed номер строки в таблице
  destRow: number,    // 1-indexed номер строки в таблице
  startCol: number,
  endCol: number,
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        copyPaste: {
          source: {
            sheetId,
            startRowIndex: sourceRow - 1,  // batchUpdate использует 0-indexed
            endRowIndex: sourceRow,
            startColumnIndex: startCol,
            endColumnIndex: endCol,
          },
          destination: {
            sheetId,
            startRowIndex: destRow - 1,
            endRowIndex: destRow,
            startColumnIndex: startCol,
            endColumnIndex: endCol,
          },
          pasteType: 'PASTE_FORMULA',  // только формулы, без значений и форматирования
        },
      }],
    },
  });
}

// ─── Публичные функции ────────────────────────────────────────────────────────

export async function readRange(range: string): Promise<string[][]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (res.data.values as string[][]) ?? [];
}

export async function writeRangeRaw(range: string, values: unknown[][]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function writeRange(range: string, values: string[][]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Если категория записанного «Расхода» совпадает с колонкой «Категория» (E)
 * какой-то строки в 🔁 Регулярные — автоматически ставим галочку «Оплачено» (F)
 * для этой строки. Экономит ручной клик: раз трата уже записана в Журнал,
 * значит платёж точно ушёл, незачем отдельно заходить в Регулярные и щёлкать
 * чекбокс. Матчит только первую НЕоплаченную строку с таким же названием
 * категории (без учёта регистра/пробелов) — если совпадений несколько,
 * остальные не трогаем, чтобы не потерять историю прошлых месяцев.
 */
export async function markRegularPaidByCategory(category: string): Promise<boolean> {
  const cat = category.trim().toLowerCase();
  if (!cat) return false;
  const rows = await readRange(`${SHEET.REGULARS}!B6:F20`);
  for (let i = 0; i < rows.length; i++) {
    const rowCategory = String(rows[i]?.[3] ?? '').trim().toLowerCase();
    const paid = String(rows[i]?.[4] ?? '').toUpperCase() === 'TRUE';
    if (rowCategory && rowCategory === cat && !paid) {
      await writeRangeRaw(`${SHEET.REGULARS}!F${6 + i}`, [[true]]);
      return true;
    }
  }
  return false;
}

export async function appendRow(range: string, values: string[]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

export async function updateJournalRow(rowNumber: number, values: string[]): Promise<void> {
  await writeRange(`${SHEET.JOURNAL}!B${rowNumber}:G${rowNumber}`, [values]);
}

export async function deleteJournalRow(rowNumber: number): Promise<void> {
  const sheets = await getSheets();
  const sheetId = await getSheetId(sheets, SHEET.JOURNAL);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,  // 0-indexed
            endIndex: rowNumber,        // exclusive
          },
        },
      }],
    },
  });
}

/**
 * Добавляет строку в Журнал операций (B:G) и копирует формулы месяца/года (H:I)
 * из предыдущей строки через Sheets API copyPaste.
 */
export async function appendOperationRow(values: string[]): Promise<void> {
  const sheets = await getSheets();
  const sheetName = SHEET.JOURNAL;

  // 1. Находим последнюю заполненную строку в колонке B (данные начинаются с B5)
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B:B`,
  });
  const rows = colRes.data.values ?? [];
  let lastDataRow = 4;  // 0-indexed; row 5 → index 4
  for (let i = 4; i < rows.length; i++) {
    if (rows[i]?.[0]) lastDataRow = i;
  }
  const lastSheetRow = lastDataRow + 1;  // 1-indexed
  const newSheetRow  = lastSheetRow + 1;

  // 2. Записываем данные (B:G) в новую строку
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B${newSheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });

  // 3. Копируем формулы (H:I — месяц и год) из предыдущей строки в новую.
  //    Google Sheets адаптирует относительные ссылки автоматически.
  //    H = 0-indexed 7, I = 8, endCol = 9 (не включительно)
  try {
    const sheetId = await getSheetId(sheets, sheetName);
    await copyRowFormulas(sheets, sheetId, lastSheetRow, newSheetRow, 7, 9);
  } catch (e) {
    console.warn('appendOperationRow: не удалось скопировать формулы (H:I):', e);
  }
}

/**
 * Добавляет строку со значениями (B:F) в лист смен, затем копирует формулы
 * (G:Z — ЗП, месяц, год и т.д.) из предыдущей строки через Sheets API copyPaste.
 *
 * @param sheetName - имя листа (используй SHEET.SHIFTS)
 * @param _dataRange - не используется, оставлен для совместимости с вызовами
 * @param values    - данные для записи в B:F
 */
export async function appendShiftRow(
  sheetName: string,
  _dataRange: string,
  values: string[],
): Promise<void> {
  const sheets = await getSheets();

  // 1. Находим последнюю заполненную строку в колонке B (данные начинаются с B5)
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B:B`,
  });
  const rows = colRes.data.values ?? [];
  let lastDataRow = 4;  // 0-indexed row 4 = spreadsheet row 5
  for (let i = 4; i < rows.length; i++) {
    if (rows[i]?.[0]) lastDataRow = i;
  }
  const lastSheetRow = lastDataRow + 1;  // 1-indexed
  const newSheetRow  = lastSheetRow + 1;

  // 2. Записываем данные (B:F) в новую строку
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B${newSheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });

  // 3. Копируем формулы (G:Z — ЗП, месяц, год, ...) из предыдущей строки в новую.
  //    G = 0-indexed 6, Z = 25, endCol = 26 (не включительно)
  try {
    const sheetId = await getSheetId(sheets, sheetName);
    await copyRowFormulas(sheets, sheetId, lastSheetRow, newSheetRow, 6, 26);
  } catch (e) {
    console.warn('appendShiftRow: не удалось скопировать формулы (G:Z):', e);
  }
}
