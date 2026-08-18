import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Находим числовой sheetId листа "🔁 Регулярные"
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = meta.data.sheets?.find(s => s.properties?.title === '🔁 Регулярные');
    if (!sheet) return NextResponse.json({ error: 'Лист не найден' }, { status: 404 });
    const sheetId = sheet.properties!.sheetId!;

    // 2. Заголовок "Оплачено?" в F4
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'🔁 Регулярные'!F4",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Оплачено?']] },
    });

    // 3. Чекбоксы в F5:F20
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 4,   // строка 5 (0-based)
              endRowIndex: 20,    // строка 20
              startColumnIndex: 5, // колонка F (A=0, B=1, C=2, D=3, E=4, F=5)
              endColumnIndex: 6,
            },
            cell: {
              dataValidation: {
                condition: { type: 'BOOLEAN' },
                showCustomUi: true,
              },
              userEnteredValue: { boolValue: false },
            },
            fields: 'dataValidation,userEnteredValue',
          },
        }],
      },
    });

    // 4. Обновляем формулу C2: считаем только НЕоплаченные платежи
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "'🔁 Регулярные'!C2",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['=SUMIF(F5:F100,FALSE,D5:D100)']] },
    });

    return NextResponse.json({ success: true, message: 'Чекбоксы добавлены, формула обновлена' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
