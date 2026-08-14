# ФИНКАБ — Полная документация для интеграции

> Этот файл содержит всё необходимое чтобы понять проект и интегрировать его в другой.  
> Можно скинуть Claude в новом проекте и сказать: «Вот ФИНКАБ, интегрируй его».

---

## 1. Что такое ФИНКАБ

Личное финансовое веб-приложение. Показывает зарплату, долги, цели, смены — и позволяет их записывать. Данные хранятся в Google Sheets, интерфейс — Next.js.

**Разделы:**
- 🏠 Дашборд — остаток на счёте, ЗП, долги, накопления, трекер темпа, цели
- ➕ Записать — форма записи операции (расход/доход) или смены
- 📅 Смены — журнал рабочих смен с фильтром по месяцу
- 📊 Зарплата — KPI по категориям (телефоны, аксессуары, техника, услуги), трекер
- 💳 Долги — список долгов с прогресс-барами погашения

---

## 2. Технический стек

| Что | Версия / Детали |
|-----|----------------|
| Фреймворк | Next.js 16.2.9, App Router |
| Язык | TypeScript, React 19 |
| Стили | Inline styles (CSS-переменные в globals.css). Tailwind v4 установлен, но кастомные классы не работали, поэтому все компоненты используют inline styles через объект `C` с цветами |
| База данных | Google Sheets (нет SQL-БД) |
| Sheets доступ | `googleapis` npm-пакет, Service Account |
| Аутентификация | Нет — приложение открытое, без логина |
| Деплой | Локально на `localhost:3000`, планируется Vercel |

---

## 3. Структура файлов

```
fincab/
├── app/
│   ├── api/                         ← Все серверные эндпоинты
│   │   ├── add/route.ts             ← POST: записать смену или операцию
│   │   ├── dashboard/route.ts       ← GET: KPI для главной страницы
│   │   ├── shifts/route.ts          ← GET: все смены из таблицы
│   │   ├── salary/route.ts          ← GET: смены по графику + трекер
│   │   ├── debts/route.ts           ← GET: список долгов
│   │   ├── goals/route.ts           ← GET: финансовые цели
│   │   └── journal/route.ts         ← GET: журнал операций
│   ├── globals.css                  ← CSS-переменные цветов + Tailwind import
│   ├── layout.tsx                   ← HTML-обёртка, шрифт Inter
│   └── page.tsx                     ← SPA: роутинг между разделами через useState
├── components/
│   ├── Navigation.tsx               ← Sticky navbar: логотип + вкладки + аватар
│   ├── Dashboard.tsx                ← Главная: 4 KPI + темп + долги + цели
│   ├── AddRecord.tsx                ← Форма: операция (слева) + смена (справа)
│   ├── Shifts.tsx                   ← Таблица смен с фильтром по месяцу
│   ├── Salary.tsx                   ← ЗП: 4 KPI + прогресс смен + трекер
│   └── Debts.tsx                    ← Долги: 3 KPI + таблица с прогрессом
├── lib/
│   └── sheets.ts                    ← Все функции работы с Google Sheets API
├── .env.local                       ← Секреты (НЕ в git)
├── .env.local.example               ← Шаблон переменных
└── package.json
```

---

## 4. Переменные окружения (.env.local)

```env
# ID таблицы из URL: https://docs.google.com/spreadsheets/d/ВОТ_ЭТО/edit
GOOGLE_SPREADSHEET_ID=1i1s9Zhg9wQ...K3kw

# Содержимое JSON-ключа сервисного аккаунта — одной строкой
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"fincab-500809","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"fincab-reader@fincab-500809.iam.gserviceaccount.com",...}
```

**Важно:** JSON вставляется целиком одной строкой, без переносов.

---

## 5. Настройка Google Sheets (как мы делали)

1. В Google Cloud Console создали проект `fincab-500809`
2. Включили Google Sheets API
3. Создали Service Account `fincab-reader@fincab-500809.iam.gserviceaccount.com`
4. Скачали JSON-ключ → положили в папку проекта (`fincab-500809-c970a65de061.json`) и скопировали содержимое в `.env.local`
5. В Google Sheets → Поделиться → дали доступ на редактирование этому email-адресу

---

## 6. Структура Google Sheets (листы и диапазоны)

### Лист `🏠 Дашборд`
```
B2:K4 — шапка с текущим месяцем/годом и KPI
  D2 = "Июн"  (месяц)
  E2 = "2026" (год)
  B4 = остаток на счёте
  E4 = зарплата за месяц
  H4 = общий долг
  K4 = накопления
```

### Лист `📅 Смены`
```
B5:G200 — данные смен (строки начинаются с 5-й)
  B = дата (DD.MM.YYYY)
  C = телефоны (штук)
  D = аксессуары (₽)
  E = техника ВП (₽)
  F = услуги (₽)
  G = ЗП за смену (ФОРМУЛА — рассчитывается автоматически)
  H = месяц (ФОРМУЛА)
  I = год (ФОРМУЛА)
```

**Критично:** При записи новой строки через API нельзя просто добавить строку — формулы в G:Z не скопируются. Поэтому используется `appendShiftRow` (см. раздел 9).

### Лист `📊 Расчёт ЗП`
```
B87:G87 — сводка смен
  C87 = смен по графику
  E87 = отработано
  G87 = осталось
B89:H97 — трекер темпа (таблица показателей)
```

### Лист `💳 Долги`
```
B6:E25 — список долгов
  B = название
  C = изначальная сумма
  D = выплачено
  E = остаток
```

### Лист `🎯 Цели`
```
B6:F25 — список целей
  B = название
  C = накоплено
  D = нужно
  E = осталось
  F = процент (%)
```

### Лист `💰 Журнал операций`
```
B5:G200 — все финансовые операции
  B = дата
  C = тип (Расход / Доход / В накопления / Из накоплений / Платёж по долгу)
  D = сумма
  E = категория
  F = цель/долг (если платёж)
  G = описание
```

---

## 7. API Endpoints

Все эндпоинты — Next.js Route Handlers. Работают на `localhost:3000` локально, после деплоя — на домене Vercel.

### GET /api/dashboard
```json
{
  "month": "Июн",
  "year": "2026",
  "balance": "42 500",
  "salary": "38 200",
  "debt": "185 000",
  "savings": "12 000",
  "pace": [["Показатель", "план", "факт", ""], ...]
}
```

### GET /api/shifts
```json
{
  "shifts": [
    {
      "date": "08.08.2026",
      "phones": "3",
      "accessories": "1500",
      "tech": "8000",
      "services": "0",
      "salary": "4200"
    }
  ]
}
```

### GET /api/salary
```json
{
  "scheduled": "22",
  "worked": "14",
  "remaining": "8",
  "pace": [["Телефоны", "22", "14", "64%"], ...]
}
```

### GET /api/debts
```json
{
  "debts": [
    { "name": "Кредит Сбер", "initial": "300000", "paid": "115000", "left": "185000" }
  ]
}
```

### GET /api/goals
```json
{
  "goals": [
    { "name": "Отпуск", "saved": "8000", "need": "50000", "left": "42000", "percent": "16%" }
  ]
}
```

### GET /api/journal
```json
{
  "entries": [
    { "date": "08.08.2026", "type": "Расход", "amount": "1200", "category": "Продукты", "target": "", "description": "Магнит" }
  ]
}
```

### POST /api/add — записать смену
```json
{
  "kind": "shift",
  "date": "08.08.2026",
  "phones": "3",
  "accessories": "1500",
  "tech": "8000",
  "services": "0"
}
```
Ответ: `{ "ok": true }`

### POST /api/add — записать операцию
```json
{
  "kind": "operation",
  "date": "08.08.2026",
  "type": "Расход",
  "amount": "1200",
  "category": "Продукты",
  "description": "Магнит"
}
```
Типы операций: `Расход`, `Доход`, `В накопления`, `Из накоплений`, `Платёж по долгу`

---

## 8. Весь код — lib/sheets.ts

```typescript
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

// ВАЖНО: обычный appendRow не копирует формулы в новую строку.
// Эта функция читает формулы из предыдущей строки и адаптирует их.
export async function appendShiftRow(
  sheetName: string,
  dataRange: string,
  values: string[],
): Promise<void> {
  const sheets = await getSheets();

  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B:B`,
  });
  const rows = colRes.data.values ?? [];
  let lastDataRow = 4;
  for (let i = 4; i < rows.length; i++) {
    if (rows[i]?.[0]) lastDataRow = i;
  }
  const lastSheetRow = lastDataRow + 1;
  const newSheetRow  = lastSheetRow + 1;

  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!G${lastSheetRow}:Z${lastSheetRow}`,
    valueRenderOption: 'FORMULA',
  });
  const formulaRow = formulaRes.data.values?.[0] ?? [];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!B${newSheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });

  if (formulaRow.length > 0) {
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
```

---

## 9. Ключевые решения и почему они такие

### Почему inline styles вместо Tailwind классов?
Tailwind v4 изменил синтаксис (теперь `@import "tailwindcss"` вместо `@tailwind base`). Кастомные CSS-классы перестали применяться к элементам, хотя Tailwind утилиты работали. Решение — убрать CSS-классы полностью и использовать inline styles через объект цветовых констант:

```typescript
const C = {
  green: '#4ade80', blue: '#6c8ef7', red: '#f87171',
  yellow: '#fbbf24', orange: '#fb923c', purple: '#a78bfa',
  sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535'
};
```

### Почему appendShiftRow, а не appendRow для смен?
Google Sheets API при добавлении строки через `append` вставляет пустые ячейки — формулы (ЗП, месяц, год) из предыдущих строк не копируются. `appendShiftRow` читает формулы из последней строки с данными через `valueRenderOption: 'FORMULA'`, заменяет номера строк через regex и записывает адаптированные формулы в новую строку.

### Почему нет своей БД?
Данные уже ведутся в Google Sheets вручную — таблица используется как основной инструмент. Приложение — удобный интерфейс поверх существующей таблицы, а не замена ей.

### Почему SPA через useState, а не Next.js Router?
Переключение разделов через `useState` быстрее (нет перезагрузки) и проще — компоненты не размонтируются при использовании через record-объект. Для одного пользователя это оптимально.

### Фильтр по месяцу в Сменах и Зарплате
Даты в таблице хранятся как строки `DD.MM.YYYY`. Парсим их в ключ `MM.YYYY` для группировки. По умолчанию выбирается текущий месяц если данные за него есть.

---

## 10. Как интегрировать ФИНКАБ в другой проект

### Вариант A: Использовать только данные через API fetch

После деплоя на Vercel в любом другом проекте:

```javascript
// Получить дашборд
const dash = await fetch('https://fincab.vercel.app/api/dashboard').then(r => r.json());
// dash.balance, dash.salary, dash.debt, dash.savings

// Получить смены
const { shifts } = await fetch('https://fincab.vercel.app/api/shifts').then(r => r.json());

// Записать смену
await fetch('https://fincab.vercel.app/api/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'shift', date: '08.08.2026',
    phones: '2', accessories: '0', tech: '5000', services: '0'
  })
});
```

### Вариант B: Скопировать lib/sheets.ts в другой Next.js проект

1. Скопируй `lib/sheets.ts` → добавит функции `readRange`, `writeRange`, `appendRow`, `appendShiftRow`
2. Добавь в `.env.local` те же две переменные
3. Установи зависимость: `npm install googleapis`
4. Используй те же диапазоны ячеек или адаптируй под свою таблицу

### Вариант C: Встроить виджет с финансовым балансом

```html
<div id="fincab-balance"></div>
<script>
  fetch('https://fincab.vercel.app/api/dashboard')
    .then(r => r.json())
    .then(d => {
      document.getElementById('fincab-balance').textContent =
        `💵 ${d.balance} ₽  |  ЗП: ${d.salary} ₽`;
    });
</script>
```

> ⚠️ Если запросы идут с другого домена — нужно добавить CORS-заголовки в API-роуты:
> ```typescript
> return NextResponse.json(data, {
>   headers: { 'Access-Control-Allow-Origin': '*' }
> });
> ```

---

## 11. Зависимости компонентов

```
page.tsx
├── Navigation.tsx          (нет API-запросов)
├── Dashboard.tsx           → /api/dashboard, /api/goals, /api/debts
├── AddRecord.tsx           → POST /api/add
├── Shifts.tsx              → /api/shifts
├── Salary.tsx              → /api/salary, /api/shifts
└── Debts.tsx               → /api/debts

app/api/*/route.ts
└── lib/sheets.ts           → Google Sheets API (googleapis)
                            → GOOGLE_SPREADSHEET_ID (env)
                            → GOOGLE_SERVICE_ACCOUNT_JSON (env)
```

---

## 12. Запуск

```bash
cd ~/fincab
npm run dev
# Открыть: http://localhost:3000
```

```bash
# Остановить
Ctrl+C
```

---

## 13. Деплой на Vercel

1. Создать репозиторий на GitHub, запушить `~/fincab`
2. В Vercel → New Project → выбрать репозиторий
3. Settings → Environment Variables → добавить `GOOGLE_SPREADSHEET_ID` и `GOOGLE_SERVICE_ACCOUNT_JSON`
4. Deploy
5. Каждый `git push` в `main` → автоматический редеплой

> ⚠️ `fincab-500809-c970a65de061.json` и `.env.local` должны быть в `.gitignore`
