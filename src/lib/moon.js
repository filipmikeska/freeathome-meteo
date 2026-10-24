// Lokální výpočet fáze Měsíce, osvětlení, východu/západu a nejbližších fází.
// Dříve se data brala z USNO API, které přestalo odpovídat — výpočet nepotřebuje žádnou externí službu.
// Ověření správnosti: scripts/verify-moon.mjs
import * as Astronomy from 'astronomy-engine';

export const LAT = 49.3794;
export const LON = 17.5658;
const ELEVATION = 200; // m n. m.
export const TZ = 'Europe/Prague';

// Pořadí odpovídá Astronomy.MoonQuarter.quarter (0–3)
const QUARTER_NAMES = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];

const observer = new Astronomy.Observer(LAT, LON, ELEVATION);

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

// Složky data a času v pražském čase
export function pragueParts(date) {
  const p = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type !== 'literal') p[type] = parseInt(value, 10);
  }
  return p;
}

// Posun pražského času vůči UTC v ms (CET +1 h, CEST +2 h)
function tzOffsetMs(date) {
  const p = pragueParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Okamžik pražské půlnoci daného dne (změna času je ve 2:00/3:00, půlnoc je vždy jednoznačná)
export function pragueMidnight(year, month, day) {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - tzOffsetMs(new Date(guess));
  t = guess - tzOffsetMs(new Date(t));
  return new Date(t);
}

const pad = (n) => String(n).padStart(2, '0');

// HH:MM zaokrouhleno na celou minutu
export function formatPragueTime(date) {
  const p = pragueParts(new Date(Math.round(date.getTime() / 60000) * 60000));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// Východ (+1) nebo západ (-1) Měsíce v intervalu [start, end), jinak null
export function findRiseSet(direction, start, end) {
  const limitDays = (end - start) / 86400000;
  const t = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, direction, start, limitDays);
  if (!t || t.date >= end) return null;
  return t.date;
}

// Všechny hlavní fáze (nov, čtvrti, úplněk) od okamžiku `from`
export function quartersFrom(from, count) {
  const result = [];
  let mq = Astronomy.SearchMoonQuarter(from);
  for (let i = 0; i < count; i++) {
    result.push({ phase: QUARTER_NAMES[mq.quarter], date: mq.time.date });
    mq = Astronomy.NextMoonQuarter(mq);
  }
  return result;
}

// Název fáze: hlavní fáze, pokud nastává v daný den, jinak mezifáze podle elongace
export function phaseName(now, dayStart, dayEnd) {
  const today = quartersFrom(dayStart, 1)[0];
  if (today.date < dayEnd) return today.phase;

  const elongation = Astronomy.MoonPhase(now); // 0 = nov, 90 = 1. čtvrť, 180 = úplněk, 270 = posl. čtvrť
  if (elongation < 90) return 'Waxing Crescent';
  if (elongation < 180) return 'Waxing Gibbous';
  if (elongation < 270) return 'Waning Gibbous';
  return 'Waning Crescent';
}

// Osvětlená část disku v procentech (0–100)
export function illuminationPercent(date) {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100;
}

// Data pro kartu MoonPhase (stejný formát, jaký vracelo USNO)
export function getMoonData(now = new Date()) {
  const p = pragueParts(now);
  const dayStart = pragueMidnight(p.year, p.month, p.day);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const dayEnd = pragueMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());

  const rise = findRiseSet(+1, dayStart, dayEnd);
  const set = findRiseSet(-1, dayStart, dayEnd);

  const upcoming = quartersFrom(now, 4).map(({ phase, date }) => {
    const q = pragueParts(date);
    return {
      phase,
      date: `${q.day}. ${q.month}.`,
      time: formatPragueTime(date),
      year: q.year,
      day: q.day,
      month: q.month,
    };
  });

  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    phase: phaseName(now, dayStart, dayEnd),
    illumination: Math.round(illuminationPercent(now)),
    moonrise: rise ? formatPragueTime(rise) : null,
    moonset: set ? formatPragueTime(set) : null,
    upcoming,
  };
}
