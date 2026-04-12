import { NextResponse } from 'next/server';
import { saveForecastSnapshot } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Cache předpovědi na 1 hodinu
let cachedForecast = null;
let cacheTimestamp = 0;
let lastSnapshotDate = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hodina

const LAT = 49.3794;
const LON = 17.5658;

const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,sunrise,sunset` +
  `&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weathercode,windspeed_10m,relativehumidity_2m` +
  `&timezone=Europe/Prague&forecast_days=7`;

export async function GET() {
  try {
    const now = Date.now();

    // Vrátit cache pokud je čerstvá a obsahuje dnešní den
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' });
    const cacheHasToday = cachedForecast?.daily?.some((d) => d.date === today);
    if (cachedForecast && (now - cacheTimestamp) < CACHE_TTL && cacheHasToday) {
      return NextResponse.json(cachedForecast);
    }

    const response = await fetch(OPEN_METEO_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();

    // Transformace denních dat
    const daily = data.daily.time.map((date, i) => ({
      date,
      weatherCode: data.daily.weathercode[i],
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitation: data.daily.precipitation_sum[i],
      windMax: data.daily.windspeed_10m_max[i],
      windDirection: data.daily.winddirection_10m_dominant[i],
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
    }));

    // Transformace hodinových dat — seskupeno po dnech
    const hourlyByDay = {};
    data.hourly.time.forEach((time, i) => {
      const day = time.slice(0, 10);
      if (!hourlyByDay[day]) hourlyByDay[day] = [];
      hourlyByDay[day].push({
        time: time.slice(11, 16), // "HH:MM"
        temperature: data.hourly.temperature_2m[i],
        feelsLike: data.hourly.apparent_temperature[i],
        precipitation: data.hourly.precipitation[i],
        precipitationProbability: data.hourly.precipitation_probability[i],
        weatherCode: data.hourly.weathercode[i],
        windSpeed: data.hourly.windspeed_10m[i],
        humidity: data.hourly.relativehumidity_2m[i],
      });
    });

    const result = {
      location: { lat: LAT, lon: LON, name: 'Pacetluky' },
      updatedAt: new Date().toISOString(),
      daily,
      hourly: hourlyByDay,
    };

    // Uložit do cache
    cachedForecast = result;
    cacheTimestamp = now;

    // Uložit snapshot předpovědi 1x denně
    if (lastSnapshotDate !== today) {
      lastSnapshotDate = today;
      try {
        for (let i = 0; i < daily.length; i++) {
          const day = daily[i];
          await saveForecastSnapshot({
            source: 'open-meteo',
            forecastDate: day.date,
            horizon: i,
            tempMax: day.tempMax,
            tempMin: day.tempMin,
            windMax: Math.round(day.windMax / 3.6 * 10) / 10, // km/h → m/s
            precipitation: day.precipitation,
          });
        }
      } catch (e) {
        console.error('Error saving Open-Meteo snapshot:', e);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching forecast:', error);

    // Vrátit starý cache pokud existuje
    if (cachedForecast) {
      return NextResponse.json({ ...cachedForecast, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
