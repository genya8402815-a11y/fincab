import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:genya8402815@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const data = await readRange("'⚙ Служебный'!E1");
    const subJson = data[0]?.[0];
    if (!subJson) {
      return NextResponse.json({ error: 'Подписка не найдена' }, { status: 404 });
    }

    const subscription = JSON.parse(subJson);

    const notifications = [
      { title: 'FinCab 💰', body: 'Не забудь внести расходы и доходы за сегодня' },
      { title: 'FinCab 📅', body: 'Не забудь заполнить смену' },
    ];

    for (const notif of notifications) {
      await webpush.sendNotification(subscription, JSON.stringify(notif));
    }

    return NextResponse.json({ success: true, sent: notifications.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
