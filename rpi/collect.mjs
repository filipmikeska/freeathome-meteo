#!/usr/bin/env node

/**
 * Sběr dat z ABB free@home meteostanice — Raspberry Pi verze
 *
 * Dlouhoběžící daemon: jeden proces, čte data každých 60 s,
 * zapisuje do Turso DB. Spouštěn jako systemd service.
 *
 * Optimalizace pro životnost SD karty:
 *   - žádný cron (= žádné PAM/auth zápisy do /var/log)
 *   - žádné diskové logy úspěšných cyklů (jen chyby do RAM)
 *   - debug log v /dev/shm (tmpfs, RAM)
 *   - vlastní zpracování Ctrl+C / SIGTERM pro čistý shutdown
 *
 * Konfigurace: rpi/.env
 *
 * Spuštění ručně (debug):
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node collect.mjs
 *
 * Spuštění jednorázové (legacy cron mód):
 *   ONESHOT=1 node collect.mjs
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appendFileSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { execFile } from 'child_process';

// SysAP používá self-signed certifikát — povolíme HTTPS bez ověření CA
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// === Konfigurace ===
const DEVICE_ID = process.env.ABB_DEVICE_ID || '7EB10000329B';
const LOCAL_HOST = process.env.ABB_LOCAL_HOST || '192.168.68.56';
const LOCAL_USER = process.env.ABB_LOCAL_USER || 'installer';
const LOCAL_PASSWORD = process.env.ABB_LOCAL_PASSWORD;

const TURSO_URL = process.env.TURSO_DATABASE_URL?.replace('libsql://', 'https://').trim();
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

const INTERVAL_MS = parseInt(process.env.COLLECT_INTERVAL_MS || '60000', 10);
const ONESHOT = process.env.ONESHOT === '1';
const DEBUG = process.env.DEBUG === '1';
const LOG_FILE = process.env.LOG_FILE || '/dev/shm/meteo.log';
// Jediný soubor zapisovaný na SD kartu — max ~1× za hodinu, přežije restart
const MARKER_FILE = process.env.MARKER_FILE || join(__dirname, '..', 'last-write.txt');
// Po tolika chybách v řadě se proces ukončí; systemd restartuje a při opakování rebootuje Pi
const MAX_CONSECUTIVE_ERRORS = parseInt(process.env.MAX_CONSECUTIVE_ERRORS || '20', 10);

const CHANNELS = {
  brightness:  { channel: 'ch0000', datapoint: 'odp0001' },
  rain:        { channel: 'ch0001', datapoint: 'odp0000' },
  temperature: { channel: 'ch0002', datapoint: 'odp0001' },
  wind:        { channel: 'ch0003', datapoint: 'odp0001' },
};

// === Logování ===
// stdout/stderr → systemd journal (volatile=RAM-only, viz journald.conf)
// LOG_FILE → /dev/shm (tmpfs/RAM), persistuje jen v rámci běhu
function ts() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function logSafe(stream, msg) {
  const line = `[${ts()}] ${msg}`;
  stream.write(line + '\n');
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

// info: jen do journalu (RAM), ne na disk
function logInfo(msg) {
  if (DEBUG) logSafe(process.stdout, msg);
}

// error: vždycky, do journalu i RAM logu
function logError(msg) {
  logSafe(process.stderr, `CHYBA: ${msg}`);
}

// startup/shutdown event: do journalu, do RAM logu
function logEvent(msg) {
  logSafe(process.stdout, msg);
}

// === Sběr dat ===

async function readDatapoint(channel, datapoint) {
  const url = `https://${LOCAL_HOST}/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/${DEVICE_ID}.${channel}.${datapoint}`;
  const auth = Buffer.from(`${LOCAL_USER}:${LOCAL_PASSWORD}`).toString('base64');

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(15_000),
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
    signal: AbortSignal.timeout(15_000),
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
  const [temperature, brightness, windSpeed, rain] = await Promise.all([
    readDatapoint(CHANNELS.temperature.channel, CHANNELS.temperature.datapoint),
    readDatapoint(CHANNELS.brightness.channel, CHANNELS.brightness.datapoint),
    readDatapoint(CHANNELS.wind.channel, CHANNELS.wind.datapoint),
    readDatapoint(CHANNELS.rain.channel, CHANNELS.rain.datapoint),
  ]);

  logInfo(`Teplota=${temperature}°C jas=${brightness}lx vitr=${windSpeed}m/s dest=${rain === 1 ? 1 : 0}`);

  await tursoExecute(
    `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain)
     VALUES (datetime('now'), ?, ?, ?, ?)`,
    [temperature, brightness, windSpeed, Math.round(rain)]
  );

  // Hodinová agregace
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

  // Denní agregace
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
}

// === Hlavní smyčka ===

let stopping = false;
let consecutiveErrors = 0;

// === Marker posledního zápisu (perzistentní, přežije restart) ===

const marker = {
  startedAt: new Date().toISOString(),
  lastSuccess: null,
  lastError: null,
  lastErrorMsg: null,
  consecutiveErrors: 0,
};
let markerHour = null;

function writeMarker(reason) {
  marker.consecutiveErrors = consecutiveErrors;
  marker.writtenAt = new Date().toISOString();
  marker.reason = reason;
  const tmp = MARKER_FILE + '.tmp';
  try {
    writeFileSync(tmp, JSON.stringify(marker, null, 2) + '\n');
    renameSync(tmp, MARKER_FILE); // atomicky — při výpadku proudu nezůstane rozbitý soubor
  } catch (e) {
    logError(`marker: ${e.message}`);
  }
}

function reportPreviousRun() {
  try {
    const prev = JSON.parse(readFileSync(MARKER_FILE, 'utf8'));
    logEvent(
      `Predchozi beh: start=${prev.startedAt} posledni_uspech=${prev.lastSuccess} ` +
      `posledni_chyba=${prev.lastError} (${prev.lastErrorMsg}) chyb_v_rade=${prev.consecutiveErrors} ` +
      `zapsano=${prev.writtenAt} duvod=${prev.reason}`
    );
  } catch {
    logEvent('Predchozi beh: marker nenalezen');
  }
}

// === systemd watchdog ===
// Ping dokazuje, že smyčka žije. Když se proces zasekne, systemd ho po WatchdogSec zabije a restartuje.
function watchdogPing() {
  if (!process.env.NOTIFY_SOCKET) return;
  execFile('systemd-notify', ['WATCHDOG=1'], () => {});
}

async function mainLoop() {
  while (!stopping) {
    const startMs = Date.now();
    try {
      await collectAndStore();
      marker.lastSuccess = new Date().toISOString();
      if (consecutiveErrors > 0) {
        logEvent(`Sber obnoven po ${consecutiveErrors} chybach`);
        consecutiveErrors = 0;
      }
      const hour = marker.lastSuccess.slice(0, 13);
      if (hour !== markerHour) {
        markerHour = hour;
        writeMarker('hourly');
      }
    } catch (err) {
      consecutiveErrors++;
      marker.lastError = new Date().toISOString();
      marker.lastErrorMsg = err.message;
      // Logujeme prvních 5 po sobě jdoucích chyb, pak rate-limit (každá 10. chyba)
      if (consecutiveErrors <= 5 || consecutiveErrors % 10 === 0) {
        logError(`${err.message} (${consecutiveErrors}. po sobe)`);
      }
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logError(`${consecutiveErrors} chyb v rade — ukoncuji, systemd restartuje sluzbu`);
        writeMarker('too-many-errors');
        process.exit(1);
      }
    }

    watchdogPing();
    if (stopping) break;

    // Spočítej, jak dlouho trval cyklus, čekej na další celou minutu
    const elapsed = Date.now() - startMs;
    const sleep = Math.max(1000, INTERVAL_MS - elapsed);
    await new Promise((r) => setTimeout(r, sleep));
  }
}

function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  logEvent(`Ukoncuji (${reason})`);
  writeMarker(`shutdown-${reason}`);
  // Krátká chvíle na flush logu, pak konec
  setTimeout(() => process.exit(0), 100);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logError(`uncaughtException: ${err.message}`);
  marker.lastError = new Date().toISOString();
  marker.lastErrorMsg = `uncaughtException: ${err.message}`;
  writeMarker('crash');
  // Necháme systemd nás restartovat
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logError(`unhandledRejection: ${err?.message || err}`);
  process.exit(1);
});

// === Start ===

if (!LOCAL_PASSWORD) {
  logError('ABB_LOCAL_PASSWORD neni nastaveno v rpi/.env');
  process.exit(1);
}
if (!TURSO_URL || !TURSO_TOKEN) {
  logError('TURSO_DATABASE_URL nebo TURSO_AUTH_TOKEN neni nastaveno v rpi/.env');
  process.exit(1);
}

if (ONESHOT) {
  collectAndStore()
    .then(() => process.exit(0))
    .catch((err) => { logError(err.message); process.exit(1); });
} else {
  logEvent(`Start (interval=${INTERVAL_MS}ms, host=${LOCAL_HOST}, log=${LOG_FILE})`);
  reportPreviousRun();
  watchdogPing();
  mainLoop().catch((err) => { logError(`mainLoop: ${err.message}`); process.exit(1); });
}
