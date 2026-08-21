import { NextRequest, NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import { DASHBOARD, RANGES, cell } from '@/lib/sheetRanges';

function n(v?: string) {
  return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.')) || 0;
}
function fmt(v: number) {
  return Math.abs(v).toLocaleString('ru-RU') + ' ₽';
}

async function sendTelegram(text: string) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Читаем дашборд и журнал параллельно
    const [header, journalRows] = await Promise.all([
      readRange(DASHBOARD.range),
      readRange(RANGES.JOURNAL),
    ]);

    const balance = n(cell(header, DASHBOARD.cells.BALANCE));

    // Сегодняшняя дата в формате DD.MM.YYYY
    const now = new Date();
    // МСК = UTC+3
    const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const dd  = String(msk.getUTCDate()).padStart(2, '0');
    const mm  = String(msk.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = msk.getUTCFullYear();
    const todayStr  = `${dd}.${mm}.${yyyy}`;
    const monthKey  = `${mm}.${yyyy}`;

    const RU_MONTHS = ['январе','феврале','марте','апреле','мае','июне',
                       'июле','августе','сентябре','октябре','ноябре','декабре'];
    const monthName = RU_MONTHS[msk.getUTCMonth()];

    // Записи из журнала
    interface Row { date: string; type: string; amount: string; category: string; }
    const entries: Row[] = journalRows
      .filter(r => r[0])
      .map(r => ({ date: r[0] ?? '', type: r[1] ?? '', amount: r[2] ?? '', category: r[3] ?? '' }));

    // Расходы сегодня
    const todayExp = entries
      .filter(e => e.date === todayStr && e.type === 'Расход')
      .reduce((s, e) => s + n(e.amount), 0);

    // Расходы за месяц
    const monthExp = entries
      .filter(e => { const p = e.date.split('.'); return p.length >= 3 && `${p[1]}.${p[2]}` === monthKey && e.type === 'Расход'; })
      .reduce((s, e) => s + n(e.amount), 0);

    // Топ-3 категории за месяц
    const catMap = new Map<string, number>();
    entries
      .filter(e => { const p = e.date.split('.'); return p.length >= 3 && `${p[1]}.${p[2]}` === monthKey && e.type === 'Расход'; })
      .forEach(e => { const c = e.category || 'Прочее'; catMap.set(c, (catMap.get(c) ?? 0) + n(e.amount)); });
    const top3 = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const top3Lines = top3.length > 0
      ? top3.map(([cat, amt]) => `  🔸 ${cat} — ${fmt(amt)}`).join('\n')
      : '  нет данных';

    const RU_DAYS = ['вс','пн','вт','ср','чт','пт','сб'];
    const dayName = RU_DAYS[msk.getUTCDay()];

    const text = [
      `📊 <b>Финкаб · ${dd} ${monthName.slice(0,3)}, ${dayName}</b>`,
      '',
      `💵 Остаток: <b>${fmt(balance)}</b>`,
      todayExp > 0
        ? `🛒 Потрачено сегодня: <b>${fmt(todayExp)}</b>`
        : `🛒 Сегодня расходов нет`,
      `📅 За месяц: <b>${fmt(monthExp)}</b>`,
      '',
      `<b>Топ категорий в ${monthName}:</b>`,
      top3Lines,
    ].join('\n');

    await sendTelegram(text);

    return NextResponse.json({ ok: true, date: todayStr });
  } catch (e) {
    console.error('[daily-summary]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
