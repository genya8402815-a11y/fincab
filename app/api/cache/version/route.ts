import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ДОБАВЛЕНО (22.08.2026, P3 #33): кеш журнала на сайте (lib/useJournal.ts)
// живёт в браузере 60 секунд и раньше не знал, если таблицу правили мимо
// сайта — вручную в Google Таблице или через бота. Здесь хранится "версия"
// журнала в Upstash Redis: POST дёргает её вверх при любой такой правке,
// GET читает её же — открытые вкладки сайта периодически сверяют версию и
// сбрасывают кеш раньше срока, если кто-то поправил таблицу без них.
//
// Если Upstash ещё не подключён — GET просто возвращает 0, POST молча ничего
// не делает: сайт продолжает работать по старому 60-секундному TTL, ничего
// не ломается.

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const VERSION_KEY = 'journal:version';

export async function GET() {
  if (!redis) return NextResponse.json({ version: 0 });
  try {
    const version = await redis.get<number>(VERSION_KEY);
    return NextResponse.json({ version: version ?? 0 });
  } catch {
    return NextResponse.json({ version: 0 });
  }
}

// Вызывается из Apps Script (onEdit-триггер и запись операций ботом) — а не
// с сайта, поэтому защищено тем же CRON_SECRET, что и cron-роуты, а не
// сессионной cookie.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!redis) return NextResponse.json({ ok: false, error: 'Redis не настроен' });
  try {
    await redis.set(VERSION_KEY, Date.now());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
