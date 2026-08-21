import { NextRequest, NextResponse } from 'next/server';
import { appendOperationRow, appendShiftRow } from '@/lib/sheets';

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

      // Накопленное по цели считается формулой прямо в листе 🎯 Цели
      // (SUMIFS по журналу) — работает одинаково для сайта, бота и ручных правок,
      // пересчитывать и перезаписывать её отсюда не нужно.

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
