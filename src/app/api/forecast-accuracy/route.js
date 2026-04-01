import { NextResponse } from 'next/server';
import { getForecastSnapshots, getDailyAggregates } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Posledních 30 dní
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [snapshots, actuals] = await Promise.all([
      getForecastSnapshots({ from, to }),
      getDailyAggregates({ from, to }),
    ]);

    // Indexovat skutečná data podle data
    const actualByDate = {};
    for (const row of actuals) {
      actualByDate[row.date] = row;
    }

    // Porovnat předpovědi s realitou (pouze horizon 0 = předpověď na ten den)
    const comparisons = [];
    const stats = {
      'open-meteo': { tempErrors: [], windErrors: [], rainHits: 0, rainTotal: 0 },
      yr: { tempErrors: [], windErrors: [], rainHits: 0, rainTotal: 0 },
    };

    for (const snap of snapshots) {
      if (snap.horizon !== 0) continue; // Pouze předpověď na "dnes"

      const actual = actualByDate[snap.forecast_date];
      if (!actual) continue;

      const tempMaxErr = actual.temp_max != null && snap.temp_max != null
        ? Math.abs(snap.temp_max - actual.temp_max) : null;
      const tempMinErr = actual.temp_min != null && snap.temp_min != null
        ? Math.abs(snap.temp_min - actual.temp_min) : null;
      const windErr = actual.wind_max != null && snap.wind_max != null
        ? Math.abs(snap.wind_max - actual.wind_max) : null;

      // Srážky: předpověď > 0 mm vs. realita rain_total_minutes > 0
      const forecastRain = snap.precipitation > 0;
      const actualRain = actual.rain_total_minutes > 0;
      const rainMatch = forecastRain === actualRain;

      const comparison = {
        date: snap.forecast_date,
        source: snap.source,
        forecast: {
          tempMax: snap.temp_max,
          tempMin: snap.temp_min,
          windMax: snap.wind_max,
          precipitation: snap.precipitation,
        },
        actual: {
          tempMax: actual.temp_max,
          tempMin: actual.temp_min,
          windMax: actual.wind_max,
          rainMinutes: actual.rain_total_minutes,
        },
        errors: {
          tempMax: tempMaxErr != null ? Math.round(tempMaxErr * 10) / 10 : null,
          tempMin: tempMinErr != null ? Math.round(tempMinErr * 10) / 10 : null,
          wind: windErr != null ? Math.round(windErr * 10) / 10 : null,
          rainMatch,
        },
      };

      comparisons.push(comparison);

      // Agregovat statistiky
      const s = stats[snap.source];
      if (s) {
        if (tempMaxErr != null) s.tempErrors.push(tempMaxErr);
        if (tempMinErr != null) s.tempErrors.push(tempMinErr);
        if (windErr != null) s.windErrors.push(windErr);
        if (rainMatch) s.rainHits++;
        s.rainTotal++;
      }
    }

    // Spočítat MAE (Mean Absolute Error)
    const summary = {};
    for (const [source, s] of Object.entries(stats)) {
      const tempMAE = s.tempErrors.length > 0
        ? Math.round(s.tempErrors.reduce((a, b) => a + b, 0) / s.tempErrors.length * 10) / 10
        : null;
      const windMAE = s.windErrors.length > 0
        ? Math.round(s.windErrors.reduce((a, b) => a + b, 0) / s.windErrors.length * 10) / 10
        : null;
      const rainAccuracy = s.rainTotal > 0
        ? Math.round(s.rainHits / s.rainTotal * 100)
        : null;

      summary[source] = {
        tempMAE,
        windMAE,
        rainAccuracy,
        days: s.rainTotal,
      };
    }

    return NextResponse.json({
      period: { from, to },
      summary,
      comparisons,
    });
  } catch (error) {
    console.error('Error computing forecast accuracy:', error);
    return NextResponse.json(
      { error: 'Failed to compute forecast accuracy' },
      { status: 500 }
    );
  }
}
