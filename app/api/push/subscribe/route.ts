import { NextResponse } from 'next/server';
import { writeRange } from '@/lib/sheets';

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    await writeRange("'⚙ Служебный'!E1", [[JSON.stringify(subscription)]]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
