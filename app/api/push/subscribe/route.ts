import { NextRequest, NextResponse } from 'next/server';
import { addSub, removeSub } from '@/lib/pushStore';

// P2 #53: подписки хранятся в Upstash Redis (lib/pushStore.ts), а не в ячейках
// листа «Служебный». Одно устройство = одно поле hash (sha256 endpoint), поэтому
// прежний класс багов с «дырами» в списке строк (P0 #44) исчез вместе с самим списком.

export async function POST(request: NextRequest) {
  try {
    const sub = await request.json();
    if (!sub?.endpoint || typeof sub.endpoint !== 'string') {
      return NextResponse.json({ error: 'No endpoint' }, { status: 400 });
    }
    const added = await addSub(sub);
    return NextResponse.json({ ok: true, action: added ? 'subscribed' : 'already_exists' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json({ error: 'No endpoint' }, { status: 400 });
    }
    const removed = await removeSub(endpoint);
    return NextResponse.json({ ok: true, action: removed ? 'unsubscribed' : 'not_found' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
