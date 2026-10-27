import { NextRequest, NextResponse } from 'next/server';
import { markRegularPaidByCategory } from '@/lib/sheets';

// P3 #1: единственная реализация правила «Расход с категорией регулярного платежа
// → галочка "Оплачено"» живёт в lib/sheets.ts (markRegularPaidByCategory).
// Раньше то же правило было продублировано в боте (Code_v2.0_FIXED.gs) — теперь
// бот просто вызывает этот эндпоинт, и править правило нужно только здесь.
//
// Вызывается из Apps Script, а не из браузера, поэтому защищён CRON_SECRET (как
// /api/cache/version), а не сессионной cookie — путь добавлен в PUBLIC_PATHS
// в middleware.ts. В отличие от cache/version здесь секрет ОБЯЗАТЕЛЕН: без него
// эндпоинт, меняющий таблицу, остался бы открытым.

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не задан' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { category } = await req.json();
    if (typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ error: 'Укажите category' }, { status: 400 });
    }
    const marked = await markRegularPaidByCategory(category);
    return NextResponse.json({ ok: true, marked });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
