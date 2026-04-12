import { NextResponse } from 'next/server';
import { yrSymbolToWmoCode } from '@/lib/weather-codes';
import { saveForecastSnapshot } from '@/lib/db';

export const dynamic = 'force-dynamic';

let cachedForecast = null;
let cacheTimestamp = 0;
let lastSnapshotDate = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hodina

const LAT = 49.3794;
const LON = 17.5658;
const TZ = 'Europe/Prague';

const YR_URL = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;
const USER_AGENT = 'freeathome-meteo/1.0 github.com/filipmikeska/freeathome-meteo';

function toLocalDate(utcTime) {
  return new Date(utcTime).toLocaleDateString('en-CA', { timeZone: TZ });
}

function toLocalTime(utcTime) {
  return new Date(utcTime).toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function transformData(timeseries) {
  // Seskupit podle dne (lokální čas)
  const byDay = {};

  for (const entry of timeseries) {
    const day = toLocalDate(entry.time);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(entry);
  }

  const days = Object.keys(byDay).sort().slice(0, 7);

  const daily = [];
  const hourlyByDay = {};

  for (const day of days) {
    const entries = byDay[day];

    // Denní agregace
    let tempMin = Infinity;
    let tempMax = -Infinity;
    let totalPrecip = 0;
    let maxWind = 0;
    let maxWindDir = 0;
    let middaySymbol = null;

    for (const entry of entries) {
      const instant = entry.data.instant.details;
      const temp = instant.air_temperature;

      if (temp < tempMin) tempMin = temp;
      if (temp > tempMax) tempMax = temp;

      if (instant.wind_speed > maxWind) {
        maxWind = instant.wind_speed;
        maxWindDir = instant.wind_from_direction;
      }

      // Srážky — preferovat next_1_hours, jinak next_6_hours (ale ne obojí)
      if (entry.data.next_1_hours) {
        totalPrecip += entry.data.next_1_hours.details.precipitation_amount || 0;
      } else if (entry.data.next_6_hours) {
        totalPrecip += entry.data.next_6_hours.details.precipitation_amount || 0;
      }

      // Použít next_6_hours min/max pokud jsou k dispozici
      if (entry.data.next_6_hours?.details) {
        const d6 = entry.data.next_6_hours.details;
        if (d6.air_temperature_max != null && d6.air_temperature_max > tempMax) {
          tempMax = d6.air_temperature_max;
        }
        if (d6.air_temperature_min != null && d6.air_temperature_min < tempMin) {
          tempMin = d6.air_temperature_min;
        }
      }

      // Symbol z poledne (10:00-14:00 lokálně)
      const localTime = toLocalTime(entry.time);
      const hour = parseInt(localTime.split(':')[0], 10);
      if (hour >= 10 && hour <= 14 && !middaySymbol) {
        const symbolCode =
          entry.data.next_1_hours?.summary?.symbol_code ||
          entry.data.next_6_hours?.summary?.symbol_code;
        if (symbolCode) middaySymbol = symbolCode;
      }
    }

    // Fallback symbol — první dostupný
    if (!middaySymbol) {
      for (const entry of entries) {
        const symbolCode =
          entry.data.next_1_hours?.summary?.symbol_code ||
          entry.data.next_6_hours?.summary?.symbol_code;
        if (symbolCode) {
          middaySymbol = symbolCode;
          break;
        }
      }
    }

    const { wmoCode } = yrSymbolToWmoCode(middaySymbol || 'cloudy');

    daily.push({
      date: day,
      weatherCode: wmoCode,
      tempMax,
      tempMin,
      precipitation: totalPrecip,
      windMax: maxWind * 3.6, // m/s → km/h (ForecastCard dělí zpět 3.6)
      windDirection: maxWindDir,
      sunrise: null,
      sunset: null,
    });

    // Hodinová data
    hourlyByDay[day] = entries
      .filter((entry) => entry.data.next_1_hours || entry.data.next_6_hours)
      .map((entry) => {
        const instant = entry.data.instant.details;
        const symbolCode =
          entry.data.next_1_hours?.summary?.symbol_code ||
          entry.data.next_6_hours?.summary?.symbol_code ||
          'cloudy';
        const { wmoCode: hourWmo } = yrSymbolToWmoCode(symbolCode);

        return {
          time: toLocalTime(entry.time),
          temperature: instant.air_temperature,
          feelsLike: null, // Yr.no neposkytuje pocitovou teplotu
          precipitation:
            entry.data.next_1_hours?.details?.precipitation_amount ||
            entry.data.next_6_hours?.details?.precipitation_amount ||
            0,
          precipitationProbability: null, // Yr.no neposkytuje pravděpodobnost
          weatherCode: hourWmo,
          windSpeed: instant.wind_speed * 3.6, // m/s → km/h
          humidity: instant.relative_humidity,
        };
      });
  }

  return {
    location: { lat: LAT, lon: LON, name: 'Pacetluky' },
    updatedAt: new Date().toISOString(),
    source: 'yr.no',
    daily,
    hourly: hourlyByDay,
  };
}

export async function GET() {
  try {
    const now = Date.now();

    // Vrátit cache pokud je čerstvá a obsahuje dnešní den
    const today = new Date().toISOString().slice(0, 10);
    const cacheHasToday = cachedForecast?.daily?.some((d) => d.date === today);
    if (cachedForecast && now - cacheTimestamp < CACHE_TTL && cacheHasToday) {
      return NextResponse.json(cachedForecast);
    }

    const response = await fetch(YR_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Yr.no API error: ${response.status}`);
    }

    const data = await response.json();
    const result = transformData(data.properties.timeseries);

    cachedForecast = result;
    cacheTimestamp = now;

    // Uložit snapshot předpovědi 1x denně
    if (lastSnapshotDate !== today) {
      lastSnapshotDate = today;
      try {
        for (let i = 0; i < result.daily.length; i++) {
          const day = result.daily[i];
          await saveForecastSnapshot({
            source: 'yr',
            forecastDate: day.date,
            horizon: i,
            tempMax: day.tempMax,
            tempMin: day.tempMin,
            windMax: Math.round(day.windMax / 3.6 * 10) / 10, // km/h → m/s
            precipitation: day.precipitation,
          });
        }
      } catch (e) {
        console.error('Error saving Yr.no snapshot:', e);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching Yr.no forecast:', error);

    if (cachedForecast) {
      return NextResponse.json({ ...cachedForecast, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to fetch Yr.no forecast' },
      { status: 500 }
    );
  }
}
