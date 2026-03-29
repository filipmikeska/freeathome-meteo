/**
 * Sběr dat z meteostanice ABB free@home.
 * Používáno GitHub Actions (scheduled) nebo ručně.
 *
 * Režim 1 (výchozí): Čte data přímo z ABB API a zapisuje do Turso DB
 * Režim 2 (COLLECT_VIA_API=true): Čte data z ABB API a posílá na /api/collect endpoint
 *
 * Spuštění: node scripts/collect-data.mjs
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const DEVICE_ID = process.env.ABB_DEVICE_ID || '7EB10000329B';

const CHANNELS = {
  brightness: { channel: 'ch0000', datapoint: 'odp0001' },
  rain:       { channel: 'ch0001', datapoint: 'odp0000' },
  temperature:{ channel: 'ch0002', datapoint: 'odp0001' },
  wind:       { channel: 'ch0003', datapoint: 'odp0001' },
};

async function readCloudDatapoint(channel, datapoint) {
  const sysapUuid = process.env.ABB_SYSAP_UUID;
  const token = process.env.ABB_CLOUD_TOKEN;
  const subscriptionKey = process.env.ABB_CLOUD_SUBSCRIPTION_KEY;

  const url = `https://apim.eu.mybuildings.abb.com/fhapi/v1/api/rest/datapoint/${sysapUuid}/${DEVICE_ID}.${channel}.${datapoint}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Cloud API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return parseFloat(data[sysapUuid]?.values?.[0] ?? '0');
}

async function readLocalDatapoint(channel, datapoint) {
  const host = process.env.ABB_LOCAL_HOST || '192.168.68.55';
  const user = process.env.ABB_LOCAL_USER || 'installer';
  const password = process.env.ABB_LOCAL_PASSWORD;

  const url = `https://${host}/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/${DEVICE_ID}.${channel}.${datapoint}`;
  const auth = Buffer.from(`${user}:${password}`).toString('base64');

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Local API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return parseFloat(data['00000000-0000-0000-0000-000000000000']?.values?.[0] ?? '0');
}

function readDatapoint(channel, datapoint) {
  const mode = process.env.ABB_API_MODE || 'cloud';
  return mode === 'local'
    ? readLocalDatapoint(channel, datapoint)
    : readCloudDatapoint(channel, datapoint);
}

async function collectAndStore() {
  console.log(`[${new Date().toISOString()}] Collecting data (mode: ${process.env.ABB_API_MODE || 'cloud'})...`);

  // Čteme všechny veličiny
  const [temperature, brightness, windSpeed, rain] = await Promise.all([
    readDatapoint(CHANNELS.temperature.channel, CHANNELS.temperature.datapoint),
    readDatapoint(CHANNELS.brightness.channel, CHANNELS.brightness.datapoint),
    readDatapoint(CHANNELS.wind.channel, CHANNELS.wind.datapoint),
    readDatapoint(CHANNELS.rain.channel, CHANNELS.rain.datapoint),
  ]);

  const measurement = {
    temperature,
    brightness,
    windSpeed,
    rain: Math.round(rain),
  };

  console.log('  Data:', measurement);

  // Režim 2: Posíláme na API endpoint
  if (process.env.COLLECT_VIA_API === 'true') {
    const apiUrl = process.env.COLLECT_API_URL;
    const apiKey = process.env.COLLECT_API_KEY;

    if (!apiUrl) throw new Error('COLLECT_API_URL is not set');

    const response = await fetch(`${apiUrl}/api/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(measurement),
    });

    if (!response.ok) {
      throw new Error(`API collect failed: ${response.status}`);
    }

    console.log('  Stored via API endpoint');
    return;
  }

  // Režim 1: Zapisujeme přímo do Turso
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await db.execute({
    sql: `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain)
          VALUES (datetime('now'), ?, ?, ?, ?)`,
    args: [temperature, brightness, windSpeed, Math.round(rain)],
  });

  console.log('  Stored directly to Turso DB');

  // Aktualizovat hodinovou agregaci pro aktuální hodinu
  const now = new Date();
  const hourStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    .toISOString().replace('T', ' ').slice(0, 19);
  const nextHourStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1)
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
    args: [hourStr, hourStr, nextHourStr],
  });

  // Aktualizovat denní agregaci
  const dateStr = now.toISOString().slice(0, 10);
  const nextDateStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

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

  console.log('  Aggregates updated');
}

collectAndStore().catch((err) => {
  console.error('Collection failed:', err);
  process.exit(1);
});
