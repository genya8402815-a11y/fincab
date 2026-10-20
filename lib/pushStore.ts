import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { readRange, writeRange } from '@/lib/sheets';
import { RANGES } from '@/lib/sheetRanges';

// P2 #53: Push-подписки раньше лежали сырым JSON в ячейках '⚙ Служебный'!E1:E50.
// Там же ключи подписки (endpoint, auth, p256dh) — с их помощью можно слать
// уведомления на устройство, а таблица может быть расшарена, экспортирована
// и попадает в бэкапы. Теперь подписки хранятся в Upstash Redis (hash `push:subs`):
//   поле  = sha256(endpoint)  — одно устройство = одно поле, дублей не бывает;
//   значение = JSON подписки.
//
// Автомиграция: при первом обращении (флаг `push:migrated` в Redis) подписки,
// которые ещё лежат в таблице, копируются в Redis и ТОЛЬКО ПОСЛЕ успешной записи
// ячейки E1:E50 очищаются. Повторно миграция не запускается.
//
// В отличие от rate-limit (fail-open), здесь Redis обязателен: если он недоступен,
// функции бросают ошибку — подписка не должна «тихо пропадать».

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

const HASH_KEY = 'push:subs';
const MIGRATED_KEY = 'push:migrated';

export interface StoredSub {
  field: string;                 // sha256(endpoint)
  sub: { endpoint: string } & Record<string, unknown>;
}

function getRedis(): Redis {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Redis не настроен (UPSTASH_REDIS_REST_KV_REST_API_URL/TOKEN)');
  }
  return new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

export function fieldFor(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

// Upstash сам разбирает JSON при чтении — значение может прийти и строкой, и объектом.
function parseSub(v: unknown): StoredSub['sub'] | null {
  try {
    const obj = typeof v === 'string' ? JSON.parse(v) : v;
    if (obj && typeof obj === 'object' && typeof (obj as { endpoint?: unknown }).endpoint === 'string') {
      return obj as StoredSub['sub'];
    }
  } catch { /* битая запись */ }
  return null;
}

async function ensureMigrated(redis: Redis): Promise<void> {
  const done = await redis.get(MIGRATED_KEY);
  if (done) return;

  let rows: string[][] = [];
  try {
    rows = await readRange(RANGES.PUSH_SUBS_LEGACY);
  } catch {
    rows = []; // лист/диапазон недоступен — переносить нечего
  }

  let moved = 0;
  for (const r of rows) {
    const raw = String(r?.[0] ?? '').trim();
    if (!raw) continue;
    const sub = parseSub(raw);
    if (!sub) continue; // битый JSON не переносим, но ячейку ниже всё равно очистим
    await redis.hset(HASH_KEY, { [fieldFor(sub.endpoint)]: JSON.stringify(sub) });
    moved++;
  }

  // Очищаем таблицу только после того, как все записи легли в Redis (исключение выше
  // прервёт функцию до этого места, и миграция повторится при следующем обращении).
  if (rows.some(r => String(r?.[0] ?? '').trim())) {
    await writeRange(RANGES.PUSH_SUBS_LEGACY, Array.from({ length: 50 }, () => ['']));
  }
  await redis.set(MIGRATED_KEY, new Date().toISOString());
  if (moved > 0) console.log(`push: перенесено подписок из таблицы в Redis: ${moved}`);
}

export async function listSubs(): Promise<StoredSub[]> {
  const redis = getRedis();
  await ensureMigrated(redis);
  const all = (await redis.hgetall<Record<string, unknown>>(HASH_KEY)) ?? {};
  const out: StoredSub[] = [];
  for (const [field, v] of Object.entries(all)) {
    const sub = parseSub(v);
    if (sub) out.push({ field, sub });
  }
  return out;
}

/** true — добавлена новая подписка, false — такая уже была (запись обновлена). */
export async function addSub(sub: { endpoint: string } & Record<string, unknown>): Promise<boolean> {
  const redis = getRedis();
  await ensureMigrated(redis);
  const field = fieldFor(sub.endpoint);
  const existed = await redis.hexists(HASH_KEY, field);
  await redis.hset(HASH_KEY, { [field]: JSON.stringify(sub) });
  return !existed;
}

/** true — подписка была и удалена. */
export async function removeSub(endpoint: string): Promise<boolean> {
  const redis = getRedis();
  await ensureMigrated(redis);
  return (await redis.hdel(HASH_KEY, fieldFor(endpoint))) > 0;
}

export async function removeByField(fields: string[]): Promise<void> {
  if (fields.length === 0) return;
  const redis = getRedis();
  await redis.hdel(HASH_KEY, ...fields);
}
