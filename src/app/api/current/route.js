import { NextResponse } from 'next/server';
import { getLatestMeasurement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const measurement = await getLatestMeasurement();

    if (!measurement) {
      return NextResponse.json(
        { error: 'No data available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      timestamp: measurement.timestamp,
      temperature: measurement.temperature,
      brightness: measurement.brightness,
      windSpeed: measurement.wind_speed,
      rain: measurement.rain,
      tempAlarm: measurement.temp_alarm,
      brightnessAlarm: measurement.brightness_alarm,
      windAlarm: measurement.wind_alarm,
      rainAlarm: measurement.rain_alarm,
    });
  } catch (error) {
    console.error('Error fetching current data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
