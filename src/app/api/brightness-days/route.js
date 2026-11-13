import { NextResponse } from 'next/server';
import { getBrightnessSamples, getBrightnessCountsByHour, getFirstMeasurementTime } from '@/lib/db';
import { pragueMidnight } from '@/lib/moon';
import { MIN_CANDIDATE_LUX, clearMinutesByDay, dayKey, parseDbTimestamp } from '@/lib/brightness';

export const dynamic = 'force-dynamic';

// Kalendář v okně „Průběh jasu“: které dny měsíce mají data a kolik minut bylo nad hranicí jasno.
// GET /api/brightness-days?month=YYYY-MM (pražský kalendářní měsíc, výchozí = aktuální)
const toDb = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentMonth = dayKey(Date.now()).slice(0, 7);
    const month = searchParams.get('month') || currentMonth;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month, expected YYYY-MM' }, { status: 400 });
    }

    const year = +month.slice(0, 4);
    const mon = +month.slice(5, 7);
    const range = {
      from: toDb(pragueMidnight(year, mon, 1)),
      to: toDb(pragueMidnight(year, mon + 1, 1)),
    };

    const [samples, counts, first] = await Promise.all([
      getBrightnessSamples({ ...range, minLux: MIN_CANDIDATE_LUX }),
      getBrightnessCountsByHour(range),
      getFirstMeasurementTime(),
    ]);

    const clear = clearMinutesByDay(samples);
    const days = {};
    for (const { hour, n } of counts) {
      const key = dayKey(parseDbTimestamp(`${hour}:00:00`));
      if (key.slice(0, 7) !== month) continue;
      if (!days[key]) days[key] = { samples: 0, clearMinutes: clear[key] || 0 };
      days[key].samples += n;
    }

    // Uplynulé měsíce se už nemění, aktuální se obnovuje po 10 minutách
    const cache = month < currentMonth
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'public, s-maxage=600, stale-while-revalidate=600';

    return NextResponse.json(
      {
        month,
        firstDay: first ? dayKey(parseDbTimestamp(first)) : null,
        today: dayKey(Date.now()),
        days,
      },
      { headers: { 'Cache-Control': cache } }
    );
  } catch (error) {
    console.error('Error fetching brightness days:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
