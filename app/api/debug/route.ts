import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';

export async function GET() {
  try {
    const dolgi = await readRange('💳 Долги!B1:H30');
    const regulyarye = await readRange('🏠 Регулярные!B1:H30');
    return NextResponse.json({ dolgi, regulyarye });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
