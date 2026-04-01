import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COORDS = '49.3794,17.5658';
const TZ = 1; // CET offset

function todayISO() {
  // Use CET date
  const now = new Date();
  const cet = new Date(now.getTime() + TZ * 3600000 + now.getTimezoneOffset() * 60000);
  return cet.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const date = todayISO();

    const [dayRes, phasesRes] = await Promise.all([
      fetch(`https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&coords=${COORDS}&tz=${TZ}`, {
        next: { revalidate: 3600 },
      }),
      fetch(`https://aa.usno.navy.mil/api/moon/phases/date?date=${date}&nump=4`, {
        next: { revalidate: 3600 },
      }),
    ]);

    if (!dayRes.ok || !phasesRes.ok) {
      return NextResponse.json({ error: 'USNO API error' }, { status: 502 });
    }

    const dayData = await dayRes.json();
    const phasesData = await phasesRes.json();

    // Extract moon data from oneday response
    const moonPhase = dayData?.properties?.data?.curphase || 'Unknown';
    const fracillum = parseFloat(dayData?.properties?.data?.fracillum || '0');
    const moonData = dayData?.properties?.data?.moondata || [];

    let moonrise = null;
    let moonset = null;
    for (const entry of moonData) {
      if (entry.phen === 'Rise' || entry.phen === 'R') moonrise = entry.time;
      if (entry.phen === 'Set' || entry.phen === 'S') moonset = entry.time;
    }

    // Extract upcoming phases
    const upcoming = (phasesData?.phasedata || []).map((p) => ({
      phase: p.phase,
      date: `${p.day}. ${p.month}.`,
      year: p.year,
      day: p.day,
      month: p.month,
    }));

    return NextResponse.json({
      date,
      phase: moonPhase,
      illumination: fracillum,
      moonrise,
      moonset,
      upcoming,
    });
  } catch (err) {
    console.error('Moon API error:', err);
    return NextResponse.json({ error: 'Failed to fetch moon data' }, { status: 500 });
  }
}
