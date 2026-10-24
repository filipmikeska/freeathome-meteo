import { NextResponse } from 'next/server';
import { getMoonData } from '@/lib/moon';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(getMoonData());
  } catch (err) {
    console.error('Moon API error:', err);
    return NextResponse.json({ error: 'Failed to compute moon data' }, { status: 500 });
  }
}
