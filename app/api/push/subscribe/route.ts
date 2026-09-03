import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange } from '@/lib/sheets';

// ДОБАВЛЕНО (P0 #44): защита от перезаписи чужой активной подписки.
//
// БЫЛО: новая подписка писалась в existing.length+1 (число НЕпустых строк + 1).
// Как только где-то в середине E1:E50 образовывалась "дыра" от отписки
// (DELETE просто стирал содержимое ячейки, не сдвигая остальные) — это число
// переставало совпадать с реальным номером первой свободной строки, и новая
// подписка тихо перезаписывала чужую живую строку. Владелец той подписки
// молча переставал получать пуш-уведомления, без ошибки и без следа.
//
// СТАЛО: тот же паттерн "компактная перезапись без дыр", что уже применён
// в categories/route.ts (задача #12) — DELETE переписывает весь диапазон
// заново без удалённой записи, а POST ищет первую РЕАЛЬНО пустую строку
// (а не "количество непустых + 1"), так что даже если дыра всё же где-то
// появится (например, ручная правка ячейки в таблице), новая подписка её
// переиспользует, а не перепрыгнет через занятую строку.

const MAX_ROWS = 50;
const RANGE = `'⚙ Служебный'!E1:E${MAX_ROWS}`;

// Полный список строк диапазона, ВКЛЮЧАЯ пустые — с сохранением позиции.
// В отличие от getAllSubs() (только непустые), нужен, чтобы честно найти
// первую свободную строку и корректно переписать диапазон при отписке.
async function getRawRows(): Promise<string[]> {
  try {
    const rows = await readRange(RANGE);
    const out: string[] = [];
    for (let i = 0; i < MAX_ROWS; i++) out.push(String(rows[i]?.[0] ?? '').trim());
    return out;
  } catch {
    return Array(MAX_ROWS).fill('');
  }
}

async function getAllSubs(): Promise<{ json: string; row: number }[]> {
  const raw = await getRawRows();
  return raw
    .map((json, i) => ({ json, row: i + 1 }))
    .filter(s => s.json);
}

// Переписывает весь столбец компактным списком (без дыр) и стирает "хвост" —
// тот же приём, что и writeCol() в categories/route.ts.
async function writeCompact(values: string[]) {
  const padded = [...values, ...Array(MAX_ROWS - values.length).fill('')].slice(0, MAX_ROWS);
  await writeRange(`'⚙ Служебный'!E1:E${MAX_ROWS}`, padded.map(v => [v]));
}

export async function POST(request: NextRequest) {
  try {
    const sub = await request.json();
    const endpoint: string = sub.endpoint;
    if (!endpoint) return NextResponse.json({ error: 'No endpoint' }, { status: 400 });

    const raw = await getRawRows();

    // Уже есть такая подписка — ничего не делаем
    if (raw.some(json => {
      if (!json) return false;
      try { return JSON.parse(json).endpoint === endpoint; } catch { return false; }
    })) {
      return NextResponse.json({ ok: true, action: 'already_exists' });
    }

    // Ищем первую РЕАЛЬНО пустую строку — не "непустых+1"
    let freeIndex = raw.findIndex(json => !json);
    if (freeIndex === -1) freeIndex = raw.length; // диапазон полностью занят — пишем следующей строкой
    const nextRow = freeIndex + 1;
    await writeRange(`'⚙ Служебный'!E${nextRow}`, [[JSON.stringify(sub)]]);
    return NextResponse.json({ ok: true, action: 'subscribed', row: nextRow });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return NextResponse.json({ error: 'No endpoint' }, { status: 400 });

    const existing = await getAllSubs();
    const idx = existing.findIndex(s => {
      try { return JSON.parse(s.json).endpoint === endpoint; } catch { return false; }
    });
    if (idx === -1) return NextResponse.json({ ok: true, action: 'not_found' });

    // Компактная перезапись без удалённой записи — без дыр для следующего POST
    const remaining = existing.filter((_, i) => i !== idx).map(s => s.json);
    await writeCompact(remaining);
    return NextResponse.json({ ok: true, action: 'unsubscribed' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
