import { NextRequest, NextResponse } from 'next/server';
import { readRange, writeRangeRaw } from '@/lib/sheets';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ row: string }> }) {
  try {
    const { row } = await params;
    const rowNum = parseInt(row);
    if (isNaN(rowNum) || rowNum < 6) return NextResponse.json({ error: 'Invalid row' }, { status: 400 });

    // Читаем текущее значение чекбокса (колонка F)
    const current = await readRange(`🔁 Регулярные!F${rowNum}`);
    const isPaid = String(current[0]?.[0] ?? '').toUpperCase() === 'TRUE';

    // Переключаем
    await writeRangeRaw(`🔁 Регулярные!F${rowNum}`, [[!isPaid]]);
    return NextResponse.json({ paid: !isPaid });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
  }
}
