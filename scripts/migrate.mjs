/**
 * Migrace databáze — vytvoří tabulky pro měření a agregace.
 * Spuštění: node scripts/migrate.mjs
 * Vyžaduje: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN v .env
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const MIGRATIONS = [
  // Raw měření
  `CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
    temperature REAL,
    brightness REAL,
    wind_speed REAL,
    rain INTEGER,
    rain_alarm INTEGER DEFAULT 0,
    temp_alarm INTEGER DEFAULT 0,
    wind_alarm INTEGER DEFAULT 0,
    brightness_alarm INTEGER DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp)`,

  // Hodinové agregace
  `CREATE TABLE IF NOT EXISTS hourly_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour DATETIME NOT NULL UNIQUE,
    temp_avg REAL,
    temp_min REAL,
    temp_max REAL,
    brightness_avg REAL,
    brightness_max REAL,
    wind_avg REAL,
    wind_max REAL,
    rain_minutes INTEGER DEFAULT 0
  )`,

  // Denní agregace
  `CREATE TABLE IF NOT EXISTS daily_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    temp_avg REAL,
    temp_min REAL,
    temp_max REAL,
    brightness_avg REAL,
    brightness_max REAL,
    wind_avg REAL,
    wind_max REAL,
    rain_total_minutes INTEGER DEFAULT 0
  )`,
];

async function migrate() {
  console.log('Running migrations...');

  for (const sql of MIGRATIONS) {
    const tableName = sql.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1];
    console.log(`  Creating: ${tableName}`);
    await db.execute(sql);
  }

  console.log('Migrations complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
