import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRange } from '@/lib/sheets';

const RANGE = "'⚙ Служебный'!E1:E50";

async function getAllSubs(): Promise<{ json: string; row: number }[]> {
  try {
    const rows = await readRange(RANGE);
    return rows
      .map((r, i) => ({ json: String(r[0] ?? '').trim(), row: i + 1 }))
      .filter(s => s.json);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const sub = await request.json();
    const endpoint: string = sub.endpoint;
    if (!endpoint) return NextResponse.json({ error: 'No endpoint' }, { status: 400 });

    const existing = await getAllSubs();

    // Уже есть такая подписка — ничего не делаем
    if (existing.some(s => {
      try { return JSON.parse(s.json).endpoint === endpoint; } catch { return false; }
    })) {
      return NextResponse.json({ ok: true, action: 'already_exists' });
    }

    // Ищем первую пустую строку (или следующую после последней)
    const nextRow = existing.length + 1;
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
    for (const s of existing) {
      try {
        if (JSON.parse(s.json).endpoint === endpoint) {
          // Очищаем ячейку
          await writeRange(`'⚙ Служебный'!E${s.row}`, [['']] );
          return NextResponse.json({ ok: true, action: 'unsubscribed' });
        }
      } catch { /* skip malformed */ }
    }
    return NextResponse.json({ ok: true, action: 'not_found' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
