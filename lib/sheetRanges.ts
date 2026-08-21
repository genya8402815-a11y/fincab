/**
 * Координаты ячеек Google Sheets — единый источник истины.
 *
 * Если ячейка или диапазон переезжает в таблице — меняешь только здесь.
 * Файл также служит документацией структуры таблицы.
 *
 * Использование:
 *   import { SHEET, DASHBOARD, RANGES } from '@/lib/sheetRanges';
 *   const data = await readRange(DASHBOARD.range);
 *   const balance = cell(data, DASHBOARD.cells.BALANCE);
 */

// ─── Имена листов ────────────────────────────────────────────────────────────

export const SHEET = {
  DASHBOARD:   '🏠 Дашборд',
  JOURNAL:     '💰 Журнал операций',
  SHIFTS:      '📅 Смены',
  SALARY_CALC: '📊 Расчёт ЗП',
  GOALS:       '🎯 Цели',
  REGULARS:    '🔁 Регулярные',
  BUDGET:      '💡 Бюджет',
  DEBTS:       '💳 Долги',
  CATEGORIES:  '⚙ Категории',
  PUSH_SUBS:   'Push',
  HISTORY:     '📈 История',
} as const;

// ─── Дашборд ─────────────────────────────────────────────────────────────────

/**
 * Основной диапазон дашборда: строки 2–4, столбцы B–K.
 *
 * Строка 2: метаданные (месяц, год, ...)
 * Строка 4: основные KPI (баланс, ЗП, долг, накопления)
 *
 * Индексы [r][c] отсчитываются от левого верхнего угла диапазона.
 * Столбцы: B=0 C=1 D=2 E=3 F=4 G=5 H=6 I=7 J=8 K=9
 * Строки:  Строка 2 → r=0,  Строка 4 → r=2
 */
export const DASHBOARD = {
  range: `${SHEET.DASHBOARD}!B2:K4`,
  cells: {
    MONTH:   { r: 0, c: 2 },  // D2 — текущий месяц ("Июн")
    YEAR:    { r: 0, c: 3 },  // E2 — текущий год ("2026")
    BALANCE: { r: 2, c: 0 },  // B4 — текущий остаток на счёте
    SALARY:  { r: 2, c: 3 },  // E4 — ожидаемый доход / зарплата
    DEBT:    { r: 2, c: 6 },  // H4 — сумма всех долгов
    SAVINGS: { r: 2, c: 9 },  // K4 — накопления
  },
} as const;

// ─── Остальные диапазоны ─────────────────────────────────────────────────────

export const RANGES = {
  PACE_TRACKER:    `${SHEET.SALARY_CALC}!B89:H97`,  // Трекер темпа смен
  JOURNAL:         `${SHEET.JOURNAL}!B5:G2000`,      // Журнал операций (все данные)
  GOALS_NAMES:     `${SHEET.GOALS}!B6:B25`,          // Названия целей
  REGULARS:        `${SHEET.REGULARS}!B5:F20`,       // Регулярные платежи
  DEBTS:           `${SHEET.DEBTS}!B6:E25`,          // Долги
  SHIFTS:          `${SHEET.SHIFTS}!B5:H2000`,       // Смены (все данные)
  SHIFTS_TEMPLATE: `${SHEET.SHIFTS}!B5:F5`,          // Шаблон первой строки смены
  CATEGORIES:      `${SHEET.CATEGORIES}!B2:B50`,     // Кастомные категории
  PUSH_SUBS:       `${SHEET.PUSH_SUBS}!E1:E50`,      // Push-подписки
  BUDGET:          `${SHEET.BUDGET}!B3:D50`,         // Бюджет (категории + лимиты + факт)
  HISTORY:         `${SHEET.HISTORY}!A:B`,           // Исторический баланс (месяц, сумма)
} as const;

// ─── Вспомогательная функция ─────────────────────────────────────────────────

/**
 * Читает ячейку из 2D-массива по именованной позиции.
 *
 * @example
 * const data = await readRange(DASHBOARD.range);
 * const balance = cell(data, DASHBOARD.cells.BALANCE); // "125000"
 */
export function cell(
  data: string[][],
  pos: { r: number; c: number },
  fallback = '0',
): string {
  return String(data[pos.r]?.[pos.c] ?? fallback);
}
