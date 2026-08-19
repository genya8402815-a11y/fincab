import { NextResponse } from 'next/server';
import { readRange, writeRange } from '@/lib/sheets';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:genya8402815@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const RANGE = "'⚙ Служебный'!E1:E50";

const NOTIFICATIONS = [
  { title: 'FinCab 💰', body: 'Не забудь внести расходы и доходы за сегодня' },
  { title: 'FinCab 📅', body: 'Не забудь заполнить смену' },
];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не задан' }, { status: 500 });

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await readRange(RANGE);
    const subs = rows
      .map((r, i) => ({ json: String(r[0] ?? '').trim(), row: i + 1 }))
      .filter(s => s.json);

    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, devices: 0, message: 'Нет подписок' });
    }

    let sent = 0;
    let failed = 0;
    const toRemove: number[] = [];

    for (const s of subs) {
      let subscription: webpush.PushSubscription;
      try { subscription = JSON.parse(s.json); } catch { toRemove.push(s.row); continue; }

      for (const notif of NOTIFICATIONS) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(notif));
          sent++;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode;
          // 410 = подписка истекла, 404 = не найдена → удаляем
          if (status === 410 || status === 404) {
            if (!toRemove.includes(s.row)) toRemove.push(s.row);
          }
          failed++;
        }
      }
    }

    // Очищаем устаревшие подписки
    for (const row of toRemove) {
      await writeRange(`'⚙ Служебный'!E${row}`, [['']] );
    }

    return NextResponse.json({
      ok: true,
      devices: subs.length,
      sent,
      failed,
      removed: toRemove.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
