import { NextResponse } from 'next/server';
import { getHistory, getHourlyAggregates, getDailyAggregates } from '@/lib/db';
import { getTimeRange } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PRESET_RANGES = ['24h', '7d', '30d'];

// Vlastní rozsah: do 48 h raw data, do 14 dní hodinové agregace, jinak denní.
// Raw data při sběru 1×/min + záložní sběr = max. ~3200 řádků za 48 h.
const RAW_MAX_HOURS = 48;
const HOURLY_MAX_HOURS = 14 * 24;
const RAW_LIMIT = 5000;

// Konverze ISO stringu na DB-kompatibilní formát "YYYY-MM-DD HH:MM:SS"
// Akceptuje "2026-05-12T06:36:00.000Z" i "2026-05-12 06:36:00"
const toDb = (s) => s.slice(0, 19).replace('T', ' ');

const spanHours = ({ from, to }) =>
  (Date.parse(to.replace(' ', 'T') + 'Z') - Date.parse(from.replace(' ', 'T') + 'Z')) / 3600000;

function mapRaw(row) {
  return {
    timestamp: row.timestamp,
    temperature: row.temperature,
    brightness: row.brightness,
    windSpeed: row.wind_speed,
    rain: row.rain,
  };
}

function mapAggregate(row, timestampKey, rainKey) {
  return {
    timestamp: row[timestampKey],
    temperature: row.temp_avg,
    tempMin: row.temp_min,
    tempMax: row.temp_max,
    brightness: row.brightness_avg,
    brightnessMax: row.brightness_max,
    windSpeed: row.wind_avg,
    windMax: row.wind_max,
    rainMinutes: row[rainKey],
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get('range');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let timeRange;
    let resolution;
    // `range` v odpovědi určuje formát popisků osy grafu (24h | 7d | 30d)
    let range;

    if (from && to) {
      timeRange = { from: toDb(from), to: toDb(to) };
      const hours = spanHours(timeRange);
      if (!(hours > 0)) {
        return NextResponse.json({ error: 'Invalid range: "from" must be before "to"' }, { status: 400 });
      }
      if (hours <= RAW_MAX_HOURS) resolution = 'raw';
      else if (hours <= HOURLY_MAX_HOURS) resolution = 'hourly';
      else resolution = 'daily';
      range = hours <= 24 ? '24h' : resolution === 'daily' ? '30d' : '7d';
    } else {
      range = PRESET_RANGES.includes(rangeParam) ? rangeParam : '24h';
      timeRange = getTimeRange(range);
      resolution = { '24h': 'raw', '7d': 'hourly', '30d': 'daily' }[range];
    }

    let data;
    if (resolution === 'raw') {
      const rows = await getHistory({ ...timeRange, limit: RAW_LIMIT });
      data = rows.map(mapRaw);
    } else if (resolution === 'hourly') {
      const rows = await getHourlyAggregates(timeRange);
      data = rows.map((row) => mapAggregate(row, 'hour', 'rain_minutes'));
    } else {
      // daily_aggregates.date je "YYYY-MM-DD" — porovnáváme jen datovou část,
      // jinak by se první den rozsahu vynechal ("2026-05-12" < "2026-05-12 06:36:00")
      const rows = await getDailyAggregates({
        from: timeRange.from.slice(0, 10),
        to: timeRange.to.slice(0, 10),
      });
      data = rows.map((row) => mapAggregate(row, 'date', 'rain_total_minutes'));
    }

    return NextResponse.json({
      range,
      resolution,
      from: timeRange.from,
      to: timeRange.to,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
