/**
 * Jednorázový přepočet minut srážek v agregacích.
 *
 * Collectory dřív počítaly 10 minut za každé měření s deštěm (platilo pro sběr 1× za 10 min).
 * Od přechodu RPi na sběr 1× za minutu byly hodnoty až 10× nadsazené.
 * Nový výpočet: podíl měření se srážkami × 60 min (nezávisí na intervalu sběru),
 * denní hodnota = součet hodinových.
 *
 * Přepočítá jen uzavřené hodiny. Probíhající hodinu a den průběžně přepočítává collector.
 * Spusťte až poté, co na RPi běží opravený collect.mjs, jinak ho starý kód přepíše.
 *
 * Spuštění:
 *   node scripts/recompute-rain-minutes.mjs           # náhled (nic nezapisuje)
 *   node scripts/recompute-rain-minutes.mjs --apply   # zápis do DB
 * Vyžaduje: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN v .env.local / .env
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const APPLY = process.argv.includes('--apply');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Nová hodnota rain_minutes pro řádek hourly_aggregates (alias h)
const NEW_HOURLY = `COALESCE((
  SELECT CAST(ROUND(SUM(CASE WHEN m.rain = 1 THEN 1 ELSE 0 END) * 60.0 / COUNT(m.rain)) AS INTEGER)
  FROM measurements m
  WHERE m.timestamp >= h.hour AND m.timestamp < datetime(h.hour, '+1 hour')
), 0)`;

// Nová hodnota rain_total_minutes pro řádek daily_aggregates (alias d)
const NEW_DAILY = `(
  SELECT COALESCE(SUM(hh.rain_minutes), 0) FROM hourly_aggregates hh
  WHERE hh.hour >= d.date || ' 00:00:00' AND hh.hour < date(d.date, '+1 day') || ' 00:00:00'
)`;

function currentHourStart() {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
  const cutoff = currentHourStart();
  console.log(APPLY ? 'Režim: ZÁPIS (--apply)' : 'Režim: náhled (bez --apply se nic nezapíše)');
  console.log(`Uzavřené hodiny před: ${cutoff} UTC\n`);

  const { rows: months } = await db.execute({
    sql: `SELECT DISTINCT substr(hour, 1, 7) AS month FROM hourly_aggregates WHERE hour < ? ORDER BY month`,
    args: [cutoff],
  });

  console.log('Měsíc     hodin  dní   srážky hodiny (stará → nová)  srážky dny (stará → nová)');
  for (const { month } of months) {
    const from = `${month}-01 00:00:00`;
    const next = new Date(Date.parse(`${month}-01T00:00:00Z`));
    next.setUTCMonth(next.getUTCMonth() + 1);
    const to = next.toISOString().slice(0, 10) + ' 00:00:00';
    const hourTo = to < cutoff ? to : cutoff;

    const { rows: [h] } = await db.execute({
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(rain_minutes), 0) AS old, COALESCE(SUM(${NEW_HOURLY}), 0) AS new
            FROM hourly_aggregates h WHERE hour >= ? AND hour < ?`,
      args: [from, hourTo],
    });

    if (APPLY) {
      await db.execute({
        sql: `UPDATE hourly_aggregates AS h SET rain_minutes = ${NEW_HOURLY} WHERE hour >= ? AND hour < ?`,
        args: [from, hourTo],
      });
    }

    // Denní hodnoty: po --apply z nových hodinových, v náhledu odhad = součet nových hodinových
    const { rows: [d] } = await db.execute({
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(rain_total_minutes), 0) AS old FROM daily_aggregates
            WHERE date >= ? AND date < ?`,
      args: [from.slice(0, 10), to.slice(0, 10)],
    });

    if (APPLY) {
      await db.execute({
        sql: `UPDATE daily_aggregates AS d SET rain_total_minutes = ${NEW_DAILY} WHERE date >= ? AND date < ?`,
        args: [from.slice(0, 10), to.slice(0, 10)],
      });
    }

    const pad = (v, n) => String(v).padStart(n);
    console.log(
      `${month}  ${pad(h.n, 5)}  ${pad(d.n, 3)}   ${pad(h.old, 9)} → ${pad(h.new, 7)}            ${pad(d.old, 9)} → ${pad(h.new, 7)}`
    );
  }

  console.log(APPLY ? '\nHotovo.' : '\nNáhled hotov. Pro zápis spusťte s --apply.');
}

main().catch((err) => {
  console.error('Přepočet selhal:', err);
  process.exit(1);
});
