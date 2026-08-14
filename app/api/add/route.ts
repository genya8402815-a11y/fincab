import { NextRequest, NextResponse } from 'next/server';
import { appendRow, appendShiftRow } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📥 /api/add body:', JSON.stringify(body));
    const { kind } = body;

    if (kind === 'operation') {
      const { date, type, amount, category, target, description } = body;
      if (!date || !type || !amount) {
        return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 });
      }
      await appendRow('💰 Журнал операций!B5:G5', [
        date, type, amount, category ?? '', target ?? '', description ?? '',
      ]);
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
