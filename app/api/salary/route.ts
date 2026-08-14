import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    // Смены: B87:G87 (граф/отраб/остал)
    const summary = await readRange('📊 Расчёт ЗП!B87:G87');
    // Трекер темпа: B89:H97
    const pace = await readRange('📊 Расчёт ЗП!B89:H97');

    // B87: "Смен в графике:" C87: число D87: "Отработано:" E87: число F87: "Осталось смен:" G87: число
    const s = summary[0] ?? [];
    return NextResponse.json({
      scheduled: s[1] ?? '0',  // C87
      worked:    s[3] ?? '0',  // E87
      remaining: s[5] ?? '0',  // G87
      pace,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка чтения зарплаты' }, { status: 500 });
  }
}
