import { NextRequest, NextResponse } from 'next/server';
import { appendOperationRow, appendShiftRow, readRange, writeRange } from '@/lib/sheets';

/**
 * После записи накопления пересчитываем сумму по целям:
 * сканируем журнал, суммируем "В накопления" минус "Из накоплений" для данной цели,
 * пишем результат в столбец C листа 🎯 Цели.
 */
async function updateGoalSaved(goalName: string): Promise<void> {
  if (!goalName?.trim()) return;
  try {
    // Читаем весь журнал (B=дата, C=тип, D=сумма, E=категория, F=цель, G=описание)
    const journal = await readRange('💰 Журнал операций!B5:F2000');
    let total = 0;
    for (const r of journal) {
      const type   = String(r[1] ?? '').trim();
      const amount = parseFloat(String(r[2] ?? '0').replace(/\s/g, '').replace(',', '.')) || 0;
      const target = String(r[4] ?? '').trim();
      if (target.toLowerCase() === goalName.trim().toLowerCase()) {
        if (type === 'В накопления')   total += amount;
        if (type === 'Из накоплений')  total -= amount;
      }
    }

    // Ищем строку цели в листе 🎯 Цели (B6:B25 = названия)
    const goalRows = await readRange('🎯 Цели!B6:B25');
    for (let i = 0; i < goalRows.length; i++) {
      const name = String(goalRows[i]?.[0] ?? '').trim();
      if (name.toLowerCase() === goalName.trim().toLowerCase()) {
        const cellRow = 6 + i; // строки начинаются с 6
        await writeRange(`🎯 Цели!C${cellRow}`, [[String(Math.max(0, total))]]);
        return;
      }
    }
  } catch (e) {
    console.warn('updateGoalSaved error:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📥 /api/add body:', JSON.stringify(body));
    const { kind } = body;

    const VALID_TYPES = ['Расход', 'Доход', 'В накопления', 'Из накоплений', 'Платёж по долгу'];

    if (kind === 'operation') {
      const { date, type, amount, category, target, description } = body;
      if (!date || !type || !amount) {
        return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 });
      }
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json({ error: 'Неверный тип операции' }, { status: 400 });
      }
      const numAmount = parseFloat(String(amount).replace(',', '.'));
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Сумма должна быть больше 0' }, { status: 400 });
      }
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
        return NextResponse.json({ error: 'Дата должна быть в формате ДД.ММ.ГГГГ' }, { status: 400 });
      }
      await appendOperationRow([
        date, type, amount, category ?? '', target ?? '', description ?? '',
      ]);

      // Если это операция с накоплениями — обновляем накоплено в листе Цели
      const isSavings = (type === 'В накопления' || type === 'Из накоплений');
      if (isSavings && target?.trim()) {
        updateGoalSaved(target).catch(e => console.warn('updateGoalSaved:', e));
      }

      return NextResponse.json({ ok: true });
    }

    if (kind === 'shift') {
      const { date, phones, accessories, tech, services } = body;
      if (!date) {
        return NextResponse.json({ error: 'Укажите дату смены' }, { status: 400 });
      }
      // Пишем только B:F, затем автоматически копируем формулы (ЗП, месяц, год) из предыдущей строки
      await appendShiftRow(
        '📅 Смены',
        'B5:F5',
        [
          date,
          phones      ?? '0',
          accessories ?? '0',
          tech        ?? '0',
          services    ?? '0',
        ],
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Неизвестный тип записи' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка записи' }, { status: 500 });
  }
}
