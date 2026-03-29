import { NextResponse } from 'next/server';
import { getHistory, getHourlyAggregates, getDailyAggregates } from '@/lib/db';
import { getTimeRange } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range'); // 24h, 7d, 30d
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let timeRange;
    if (from && to) {
      timeRange = { from, to };
    } else if (range) {
      timeRange = getTimeRange(range);
    } else {
      timeRange = getTimeRange('24h');
    }

    // Pro krátké rozsahy vrátíme raw data, pro delší agregace
    const effectiveRange = range || '24h';
    let data;

    if (effectiveRange === '24h') {
      // Raw data (max ~144 bodů při 10min intervalu)
      data = await getHistory({ ...timeRange, limit: 2000 });
      data = data.map((row) => ({
        timestamp: row.timestamp,
        temperature: row.temperature,
        brightness: row.brightness,
        windSpeed: row.wind_speed,
        rain: row.rain,
      }));
    } else if (effectiveRange === '7d') {
      // Hodinové agregace
      data = await getHourlyAggregates(timeRange);
      data = data.map((row) => ({
        timestamp: row.hour,
        temperature: row.temp_avg,
        tempMin: row.temp_min,
        tempMax: row.temp_max,
        brightness: row.brightness_avg,
        brightnessMax: row.brightness_max,
        windSpeed: row.wind_avg,
        windMax: row.wind_max,
        rainMinutes: row.rain_minutes,
      }));
    } else {
      // Denní agregace
      data = await getDailyAggregates(timeRange);
      data = data.map((row) => ({
        timestamp: row.date,
        temperature: row.temp_avg,
        tempMin: row.temp_min,
        tempMax: row.temp_max,
        brightness: row.brightness_avg,
        brightnessMax: row.brightness_max,
        windSpeed: row.wind_avg,
        windMax: row.wind_max,
        rainMinutes: row.rain_total_minutes,
      }));
    }

    return NextResponse.json({
      range: effectiveRange,
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
