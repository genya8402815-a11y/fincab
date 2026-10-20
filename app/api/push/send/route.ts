import { NextResponse } from 'next/server';
import { listSubs, removeByField } from '@/lib/pushStore';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:genya8402815@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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
    // P2 #53: подписки читаем из Redis (lib/pushStore.ts), не из таблицы.
    const subs = await listSubs();

    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, devices: 0, message: 'Нет подписок' });
    }

    let sent = 0;
    let failed = 0;
    const toRemove: string[] = [];

    for (const s of subs) {
      const subscription = s.sub as unknown as webpush.PushSubscription;

      for (const notif of NOTIFICATIONS) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(notif));
          sent++;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode;
          // 410 = подписка истекла, 404 = не найдена → удаляем
          if (status === 410 || status === 404) {
            if (!toRemove.includes(s.field)) toRemove.push(s.field);
          }
          failed++;
        }
      }
    }

    // Очищаем устаревшие подписки
    await removeByField(toRemove);

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
