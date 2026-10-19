import { NextRequest, NextResponse } from 'next/server';
import { updateJournalRow, deleteJournalRow, journalRowMatches, parseMoney } from '@/lib/sheets';

// P1 #50: правка/удаление адресуются номером строки, а удаление физически
// сдвигает строки. Клиент присылает `expected` (дата/тип/сумма записи, какой он её
// видел) — если в строке уже другая запись, отказываем (409), а не правим чужую.
const STALE_MSG = 'Запись изменилась (возможно, её удалили или добавили с другого устройства). Обновите журнал и повторите.';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ row: string }> }) {
  try {
    const { row } = await params;
    const rowNum = parseInt(row);
    if (isNaN(rowNum) || rowNum < 5) return NextResponse.json({ error: 'Invalid row' }, { status: 400 });
    const body = await req.json();

    if (body.expected && !(await journalRowMatches(rowNum, body.expected))) {
      return NextResponse.json({ error: STALE_MSG }, { status: 409 });
    }

    // Сумма — ЧИСЛОМ: строка вида "104199.72" в таблице с русской локалью
    // (десятичная запятая) записывается как текст, и SUMIF её не видит.
    const amount = parseMoney(body.amount);
    if (isNaN(amount) || amount === 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }
    const values: (string | number)[] = [
      body.date        ?? '',
      body.type        ?? '',
      amount,
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ row: string }> }) {
  try {
    const { row } = await params;
    const rowNum = parseInt(row);
    if (isNaN(rowNum) || rowNum < 5) return NextResponse.json({ error: 'Invalid row' }, { status: 400 });

    let expected: { date?: string; type?: string; amount?: unknown } | undefined;
    try { expected = (await req.json())?.expected; } catch { /* тело не обязательно */ }
    if (expected && !(await journalRowMatches(rowNum, expected))) {
      return NextResponse.json({ error: STALE_MSG }, { status: 409 });
    }

    await deleteJournalRow(rowNum);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
