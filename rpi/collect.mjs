#!/usr/bin/env node

/**
 * Sběr dat z ABB free@home meteostanice — Raspberry Pi verze
 *
 * Čte data z lokálního API SysAP a zapisuje přímo do Turso DB.
 * Spouštěno přes cron každých 10 minut.
 *
 * Konfigurace: rpi/.env
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Načti .env ze složky rpi/
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// === Konfigurace ===
const DEVICE_ID = process.env.ABB_DEVICE_ID || '7EB10000329B';
const LOCAL_HOST = process.env.ABB_LOCAL_HOST || '192.168.68.55';
const LOCAL_USER = process.env.ABB_LOCAL_USER || 'installer';
const LOCAL_PASSWORD = process.env.ABB_LOCAL_PASSWORD;

const TURSO_URL = process.env.TURSO_DATABASE_URL?.replace('libsql://', 'https://').trim();
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

const CHANNELS = {
  brightness:  { channel: 'ch0000', datapoint: 'odp0001' },
  rain:        { channel: 'ch0001', datapoint: 'odp0000' },
  temperature: { channel: 'ch0002', datapoint: 'odp0001' },
  wind:        { channel: 'ch0003', datapoint: 'odp0001' },
};

// === Funkce ===

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] ${msg}`);
}

async function readDatapoint(channel, datapoint) {
  const url = `https://${LOCAL_HOST}/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/${DEVICE_ID}.${channel}.${datapoint}`;
  const auth = Buffer.from(`${LOCAL_USER}:${LOCAL_PASSWORD}`).toString('base64');

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`SysAP API ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const value = data['00000000-0000-0000-0000-000000000000']?.values?.[0];
  return parseFloat(value ?? '0');
}

async function tursoExecute(sql, args = []) {
  const stmtArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') {
      return Number.isInteger(a)
        ? { type: 'integer', value: String(a) }
        : { type: 'float', value: a };
    }
    return { type: 'text', value: String(a) };
  });

  const response = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: stmtArgs } },
        { type: 'close' },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turso API ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (data.results?.[0]?.type === 'error') {
    throw new Error(`SQL error: ${data.results[0].error?.message}`);
  }

  return data;
}

async function collectAndStore() {
  // 1. Přečíst data z meteostanice
  log('Čtu data z meteostanice...');

  const [temperature, brightness, windSpeed, rain] = await Promise.all([
    readDatapoint(CHANNELS.temperature.channel, CHANNELS.temperature.datapoint),
    readDatapoint(CHANNELS.brightness.channel, CHANNELS.brightness.datapoint),
    readDatapoint(CHANNELS.wind.channel, CHANNELS.wind.datapoint),
    readDatapoint(CHANNELS.rain.channel, CHANNELS.rain.datapoint),
  ]);

  log(`  Teplota:  ${temperature} °C`);
  log(`  Jas:      ${brightness} lux`);
  log(`  Vítr:     ${windSpeed} m/s`);
  log(`  Déšť:     ${rain === 1 ? 'ANO' : 'NE'}`);

  // 2. Uložit do Turso DB
  log('Ukládám do databáze...');

  await tursoExecute(
    `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain)
     VALUES (datetime('now'), ?, ?, ?, ?)`,
    [temperature, brightness, windSpeed, Math.round(rain)]
  );

  // 3. Aktualizovat hodinovou agregaci
  const now = new Date();
  const hourStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    .toISOString().replace('T', ' ').slice(0, 19);
  const nextHourStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1)
    .toISOString().replace('T', ' ').slice(0, 19);

  await tursoExecute(
    `INSERT OR REPLACE INTO hourly_aggregates
       (hour, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
        wind_avg, wind_max, rain_minutes)
     SELECT ?,
       AVG(temperature), MIN(temperature), MAX(temperature),
       AVG(brightness), MAX(brightness),
       AVG(wind_speed), MAX(wind_speed),
       SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
     FROM measurements
     WHERE timestamp >= ? AND timestamp < ?`,
    [hourStr, hourStr, nextHourStr]
  );

  // 4. Aktualizovat denní agregaci
  const dateStr = now.toISOString().slice(0, 10);
  const nextDateStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  await tursoExecute(
    `INSERT OR REPLACE INTO daily_aggregates
       (date, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
        wind_avg, wind_max, rain_total_minutes)
     SELECT ?,
       AVG(temperature), MIN(temperature), MAX(temperature),
       AVG(brightness), MAX(brightness),
       AVG(wind_speed), MAX(wind_speed),
       SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
     FROM measurements
     WHERE timestamp >= ? AND timestamp < ?`,
    [dateStr, dateStr + ' 00:00:00', nextDateStr + ' 00:00:00']
  );

  log('Hotovo!');
}

// === Spuštění ===

// Ověření konfigurace
if (!LOCAL_PASSWORD) {
  console.error('CHYBA: ABB_LOCAL_PASSWORD není nastaveno v rpi/.env');
  process.exit(1);
}
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('CHYBA: TURSO_DATABASE_URL nebo TURSO_AUTH_TOKEN není nastaveno v rpi/.env');
  process.exit(1);
}

collectAndStore().catch((err) => {
  log(`CHYBA: ${err.message}`);
  process.exit(1);
});
