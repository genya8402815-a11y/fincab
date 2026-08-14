import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    const salary87 = await readRange('📊 Расчёт ЗП!B87:G87');
    const salary89 = await readRange('📊 Расчёт ЗП!B89:H97');
    const dash = await readRange('🏠 Дашборд!B2:K4');
    return NextResponse.json({ salary87, salary89, dash });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
