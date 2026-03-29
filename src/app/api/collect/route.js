import { NextResponse } from 'next/server';
import { insertMeasurement } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST — přijme data z GitHub Actions nebo externího collectoru
export async function POST(request) {
  try {
    // Ověření API klíče
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.COLLECT_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { temperature, brightness, windSpeed, rain,
            tempAlarm, brightnessAlarm, windAlarm, rainAlarm } = body;

    if (temperature == null || brightness == null || windSpeed == null || rain == null) {
      return NextResponse.json(
        { error: 'Missing required fields: temperature, brightness, windSpeed, rain' },
        { status: 400 }
      );
    }

    await insertMeasurement({
      temperature: parseFloat(temperature),
      brightness: parseFloat(brightness),
      windSpeed: parseFloat(windSpeed),
      rain: parseInt(rain),
      tempAlarm: parseInt(tempAlarm) || 0,
      brightnessAlarm: parseInt(brightnessAlarm) || 0,
      windAlarm: parseInt(windAlarm) || 0,
      rainAlarm: parseInt(rainAlarm) || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error collecting data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
