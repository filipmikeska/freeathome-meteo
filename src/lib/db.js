import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error('TURSO_DATABASE_URL is not set');
    }

    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

// Vloží nové měření
export async function insertMeasurement(data) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain,
            rain_alarm, temp_alarm, wind_alarm, brightness_alarm)
          VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.temperature,
      data.brightness,
      data.windSpeed,
      data.rain,
      data.rainAlarm ?? 0,
      data.tempAlarm ?? 0,
      data.windAlarm ?? 0,
      data.brightnessAlarm ?? 0,
    ],
  });
}

// Vrátí poslední měření
export async function getLatestMeasurement() {
  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1'
  );
  return result.rows[0] || null;
}

// Vrátí historická data pro zadaný rozsah
export async function getHistory({ from, to, limit = 1000 }) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM measurements
          WHERE timestamp BETWEEN ? AND ?
          ORDER BY timestamp ASC
          LIMIT ?`,
    args: [from, to, limit],
  });
  return result.rows;
}

// Vrátí hodinové agregace pro zadaný rozsah
export async function getHourlyAggregates({ from, to }) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM hourly_aggregates
          WHERE hour BETWEEN ? AND ?
          ORDER BY hour ASC`,
    args: [from, to],
  });
  return result.rows;
}

// Vrátí denní agregace pro zadaný rozsah
export async function getDailyAggregates({ from, to }) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM daily_aggregates
          WHERE date BETWEEN ? AND ?
          ORDER BY date ASC`,
    args: [from, to],
  });
  return result.rows;
}

// Spočítá a uloží hodinovou agregaci pro danou hodinu
export async function computeHourlyAggregate(hourStr) {
  const db = getDb();
  const nextHour = new Date(new Date(hourStr).getTime() + 3600000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  await db.execute({
    sql: `INSERT OR REPLACE INTO hourly_aggregates
            (hour, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
             wind_avg, wind_max, rain_minutes)
          SELECT
            ?,
            AVG(temperature), MIN(temperature), MAX(temperature),
            AVG(brightness), MAX(brightness),
            AVG(wind_speed), MAX(wind_speed),
            SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
          FROM measurements
          WHERE timestamp >= ? AND timestamp < ?`,
    args: [hourStr, hourStr, nextHour],
  });
}

// Spočítá a uloží denní agregaci
export async function computeDailyAggregate(dateStr) {
  const db = getDb();
  const nextDate = new Date(new Date(dateStr + 'T00:00:00Z').getTime() + 86400000)
    .toISOString()
    .slice(0, 10);

  await db.execute({
    sql: `INSERT OR REPLACE INTO daily_aggregates
            (date, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
             wind_avg, wind_max, rain_total_minutes)
          SELECT
            ?,
            AVG(temperature), MIN(temperature), MAX(temperature),
            AVG(brightness), MAX(brightness),
            AVG(wind_speed), MAX(wind_speed),
            SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
          FROM measurements
          WHERE timestamp >= ? AND timestamp < ?`,
    args: [dateStr, dateStr + ' 00:00:00', nextDate + ' 00:00:00'],
  });
}

// Smaže raw záznamy starší než zadaný počet dní
export async function cleanupOldMeasurements(retentionDays = 365) {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM measurements
          WHERE timestamp < datetime('now', ?)`,
    args: [`-${retentionDays} days`],
  });
}
