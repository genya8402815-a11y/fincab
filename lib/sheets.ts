import { google } from 'googleapis';

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

export async function readRange(range: string): Promise<string[][]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (res.data.values as string[][]) ?? [];
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

/**
 * Добавляет строку в Журнал операций (B:G) и копирует формулы месяца/года (H:I)
 * из предыдущей строки в новую.
 */
export async function appendOperationRow(values: string[]): Promise<void> {
  const sheets = await getSheets();
  const sheetName = '💰 Журнал операций';

  // 1. Находим последнюю заполненную строку в колонке B (начиная с 5)
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B:B`,
  });
  const rows = colRes.data.values ?? [];
  let lastDataRow = 4; // 0-indexed; row 5 = index 4
  for (let i = 4; i < rows.length; i++) {
    if (rows[i]?.[0]) lastDataRow = i;
  }
  const lastSheetRow = lastDataRow + 1; // 1-indexed
  const newSheetRow  = lastSheetRow + 1;

  // 2. Читаем формулы из H:I последней строки
  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!H${lastSheetRow}:I${lastSheetRow}`,
    valueRenderOption: 'FORMULA',
  } as Parameters<typeof sheets.spreadsheets.values.get>[0]);
  const formulaRow = formulaRes.data.values?.[0] ?? [];

  // 3. Записываем данные (B:G) в новую строку
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B${newSheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });

  // 4. Адаптируем формулы к новой строке и записываем H:I
  if (formulaRow.length > 0) {
    const adaptedFormulas = formulaRow.map((f: string) =>
      typeof f === 'string' && f.startsWith('=')
        ? f.replace(new RegExp(`${lastSheetRow}`, 'g'), String(newSheetRow))
        : f
    );
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!H${newSheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [adaptedFormulas] },
    });
  }
}

/**
 * Добавляет строку со значениями (B:F), затем копирует формулы из предыдущей строки
 * для колонок G и далее (ЗП, месяц, год и т.д.)
 */
export async function appendShiftRow(
  sheetName: string,
  dataRange: string,   // напр. "B5:F5"
  values: string[],
): Promise<void> {
  const sheets = await getSheets();

  // 1. Получаем текущее кол-во строк с данными чтобы знать номер последней строки
  const colB = `${sheetName}!B:B`;
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: colB,
  });
  const rows = colRes.data.values ?? [];
  // Находим последнюю непустую строку в колонке B (с данными смен, начиная с B5)
  let lastDataRow = 4; // 0-indexed row 4 = spreadsheet row 5
  for (let i = 4; i < rows.length; i++) {
    if (rows[i]?.[0]) lastDataRow = i;
  }
  const lastSheetRow = lastDataRow + 1; // 1-indexed
  const newSheetRow  = lastSheetRow + 1;

  // 2. Читаем формулы из последней строки с данными (G..Z)
  const formulaRange = `${sheetName}!G${lastSheetRow}:Z${lastSheetRow}`;
  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: formulaRange,
    valueRenderOption: 'FORMULA',
  });
  const formulaRow = formulaRes.data.values?.[0] ?? [];

  // 3. Записываем данные (B:F) в новую строку
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B${newSheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });

  // 4. Если есть формулы — адаптируем их к новой строке и пишем
  if (formulaRow.length > 0) {
    // Заменяем номер строки в формулах (напр. B87 → B88)
    const adaptedFormulas = formulaRow.map((f: string) =>
      typeof f === 'string' && f.startsWith('=')
        ? f.replace(new RegExp(`${lastSheetRow}`, 'g'), String(newSheetRow))
        : f
    );
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!G${newSheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [adaptedFormulas] },
    });
  }
}
