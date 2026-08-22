import { NextRequest, NextResponse } from 'next/server';
import { appendOperationRow, appendShiftRow, markRegularPaidByCategory } from '@/lib/sheets';
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';

// ДОБАВЛЕНО (22.08.2026, P3 #35): защита от двойной записи операции.
// Отпечаток (хэш ключевых полей) кладётся в Redis через SET NX с коротким TTL.
// Если тот же отпечаток прилетает повторно в это окно — считаем это дублем
// (двойной тап по кнопке, зависший запрос + повторная отправка, ретрай
// шортката) и не пишем вторую строку в журнал.
//
// Если Redis не настроен или недоступен — проверку молча пропускаем
// (приоритет отдаём доступности записи, а не строгости защиты — тот же
// принцип, что и в middleware.ts для rate-limit).
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const DUPLICATE_WINDOW_S = 10;

async function isDuplicate(fingerprint: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const key = `dup:${fingerprint}`;
    const setOk = await redis.set(key, '1', { nx: true, ex: DUPLICATE_WINDOW_S });
    return setOk === null; // null = ключ уже существовал → это повтор
  } catch {
    return false; // сбой Redis — не блокируем запись
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

      const opFingerprint = createHash('sha256')
        .update(`op:${date}:${type}:${amount}:${category ?? ''}:${target ?? ''}:${description ?? ''}`)
        .digest('hex');
      if (await isDuplicate(opFingerprint)) {
        return NextResponse.json(
          { error: 'Похожая операция уже была записана пару секунд назад — проверьте журнал, чтобы не задвоить' },
          { status: 409 },
        );
      }

      await appendOperationRow([
        date, type, amount, category ?? '', target ?? '', description ?? '',
      ]);

      // Накопленное по цели считается формулой прямо в листе 🎯 Цели
      // (SUMIFS по журналу) — работает одинаково для сайта, бота и ручных правок,
      // пересчитывать и перезаписывать её отсюда не нужно.

      // ДОБАВЛЕНО (22.08.2026): если это Расход с категорией, совпадающей с
      // категорией регулярного платежа (аренда, связь и т.п.) — автоматически
      // ставим галочку "Оплачено" в 🔁 Регулярные, чтобы не отмечать вручную.
      if (type === 'Расход' && category) {
        try { await markRegularPaidByCategory(category); }
        catch (e) { console.warn('markRegularPaidByCategory:', e); }
      }

      return NextResponse.json({ ok: true });
    }

    if (kind === 'shift') {
      const { date, phones, accessories, tech, services } = body;
      if (!date) {
        return NextResponse.json({ error: 'Укажите дату смены' }, { status: 400 });
      }

      const shiftFingerprint = createHash('sha256')
        .update(`shift:${date}:${phones ?? ''}:${accessories ?? ''}:${tech ?? ''}:${services ?? ''}`)
        .digest('hex');
      if (await isDuplicate(shiftFingerprint)) {
        return NextResponse.json(
          { error: 'Похожая смена уже была записана пару секунд назад — проверьте лист' },
          { status: 409 },
        );
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
