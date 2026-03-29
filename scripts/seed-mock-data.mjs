/**
 * Generátor testovacích dat — naplní databázi realistickými daty za posledních 30 dní.
 * Spuštění: node scripts/seed-mock-data.mjs
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Simulace realistického počasí v ČR (březen/duben)
function generateTemperature(hour, dayOffset) {
  // Denní cyklus: nejnižší kolem 5:00, nejvyšší kolem 14:00
  const baseTemp = 5 + Math.sin((dayOffset / 30) * Math.PI) * 5; // sezonní
  const dailyVariation = Math.sin(((hour - 5) / 24) * 2 * Math.PI) * 6;
  const noise = (Math.random() - 0.5) * 2;
  return Math.round((baseTemp + dailyVariation + noise) * 10) / 10;
}

function generateBrightness(hour) {
  // Noc = 0, den = max kolem poledne
  if (hour < 6 || hour > 21) return Math.random() * 5;
  const peak = Math.sin(((hour - 6) / 15) * Math.PI);
  const cloudFactor = 0.3 + Math.random() * 0.7; // oblačnost
  return Math.round(peak * 80000 * cloudFactor * 10) / 10;
}

function generateWindSpeed(hour) {
  // Vítr je silnější odpoledne
  const base = 1 + Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 2;
  const gust = Math.random() * 3;
  return Math.max(0, Math.round((base + gust) * 10) / 10);
}

function generateRain(hour, dayOffset) {
  // Náhodné dešťové epizody
  const rainChance = 0.15; // 15% šance na déšť
  const seed = Math.sin(dayOffset * 137.5 + hour * 7.3) * 10000;
  return (seed - Math.floor(seed)) < rainChance ? 1 : 0;
}

async function seed() {
  console.log('Seeding mock data for last 30 days...');

  const now = new Date();
  const batchSize = 100;
  let batch = [];
  let totalRows = 0;

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    for (let hour = 0; hour < 24; hour++) {
      // Každých 10 minut
      for (let minute = 0; minute < 60; minute += 10) {
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        date.setHours(hour, minute, 0, 0);

        if (date > now) continue;

        const temperature = generateTemperature(hour, dayOffset);
        const brightness = generateBrightness(hour);
        const windSpeed = generateWindSpeed(hour);
        const rain = generateRain(hour, dayOffset);

        const timestamp = date.toISOString().replace('T', ' ').slice(0, 19);

        batch.push({
          sql: `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain,
                  rain_alarm, temp_alarm, wind_alarm, brightness_alarm)
                VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)`,
          args: [timestamp, temperature, brightness, windSpeed, rain],
        });

        if (batch.length >= batchSize) {
          await db.batch(batch);
          totalRows += batch.length;
          batch = [];
          if (totalRows % 1000 === 0) {
            process.stdout.write(`  ${totalRows} rows...\r`);
          }
        }
      }
    }
  }

  // Zbytek
  if (batch.length > 0) {
    await db.batch(batch);
    totalRows += batch.length;
  }

  console.log(`\n  Inserted ${totalRows} measurements`);

  // Spočítat hodinové agregace
  console.log('  Computing hourly aggregates...');
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(hour, 0, 0, 0);
      if (date > now) continue;

      const hourStr = date.toISOString().replace('T', ' ').slice(0, 19);
      const nextHour = new Date(date.getTime() + 3600000)
        .toISOString().replace('T', ' ').slice(0, 19);

      await db.execute({
        sql: `INSERT OR REPLACE INTO hourly_aggregates
                (hour, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
                 wind_avg, wind_max, rain_minutes)
              SELECT ?,
                AVG(temperature), MIN(temperature), MAX(temperature),
                AVG(brightness), MAX(brightness),
                AVG(wind_speed), MAX(wind_speed),
                SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
              FROM measurements
              WHERE timestamp >= ? AND timestamp < ?`,
        args: [hourStr, hourStr, nextHour],
      });
    }
  }

  // Spočítat denní agregace
  console.log('  Computing daily aggregates...');
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().slice(0, 10);
    const nextDateStr = new Date(date.getTime() + 86400000).toISOString().slice(0, 10);

    await db.execute({
      sql: `INSERT OR REPLACE INTO daily_aggregates
              (date, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
               wind_avg, wind_max, rain_total_minutes)
            SELECT ?,
              AVG(temperature), MIN(temperature), MAX(temperature),
              AVG(brightness), MAX(brightness),
              AVG(wind_speed), MAX(wind_speed),
              SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
            FROM measurements
            WHERE timestamp >= ? AND timestamp < ?`,
      args: [dateStr, dateStr + ' 00:00:00', nextDateStr + ' 00:00:00'],
    });
  }

  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
