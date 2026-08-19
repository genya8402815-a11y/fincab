import { NextRequest, NextResponse } from 'next/server';
import { updateJournalRow, deleteJournalRow } from '@/lib/sheets';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ row: string }> }) {
  try {
    const { row } = await params;
    const rowNum = parseInt(row);
    if (isNaN(rowNum) || rowNum < 5) return NextResponse.json({ error: 'Invalid row' }, { status: 400 });
    const body = await req.json();
    const values = [
      body.date        ?? '',
      body.type        ?? '',
      String(body.amount ?? ''),
      body.category    ?? '',
      body.target      ?? '',
      body.description ?? '',
    ];
    await updateJournalRow(rowNum, values);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ row: string }> }) {
  try {
    const { row } = await params;
    const rowNum = parseInt(row);
    if (isNaN(rowNum) || rowNum < 5) return NextResponse.json({ error: 'Invalid row' }, { status: 400 });
    await deleteJournalRow(rowNum);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
