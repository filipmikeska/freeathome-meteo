// Průběh jasu během dne — výpočty pro okno „Průběh jasu“ (dlaždice Jas).
// Slouží hlavně k odhadu, kolik bylo slunce pro fotovoltaický ohřev vody.
import * as Astronomy from 'astronomy-engine';
import { LAT, LON, TZ, pragueParts, pragueMidnight } from './moon.js';
import { clearThresholdLux } from './utils.js';

// Hranice „jasno“ není pevná: je to 70 % jasu jasné oblohy pro aktuální výšku Slunce
// (clearThresholdLux v utils.js, stejný model jako u dlaždice Jas). Ráno a v zimě je nižší.

// Úseky nad hranicí: mezery do 5 min se slučují, úseky pod 10 min se nevypisují
const MERGE_GAP_MIN = 5;
const MIN_LISTED_MIN = 10;
// Jedno měření reprezentuje čas do dalšího, nejvýš však tolik (výpadek sběru se nepočítá)
const MAX_SAMPLE_MIN = 10;

const MIN = 60000;
const observer = new Astronomy.Observer(LAT, LON, 200);

const pad = (n) => String(n).padStart(2, '0');

// Klíč pražského dne "YYYY-MM-DD" pro okamžik (Date nebo epoch ms)
export function dayKey(t) {
  const p = pragueParts(new Date(t));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Posun v dnech mezi dvěma klíči dne (b − a)
export function daysBetween(a, b) {
  const utc = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((utc(b) - utc(a)) / 86400000);
}

// Klíč dne posunutý o `n` dní
export function shiftDayKey(key, n) {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Pražský den posunutý o `offset` dní od dneška → { start, end } jako Date
export function pragueDay(offset = 0, now = new Date()) {
  const p = pragueParts(now);
  const at = (d) => {
    const u = new Date(Date.UTC(p.year, p.month - 1, p.day + d));
    return pragueMidnight(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
  };
  return { start: at(offset), end: at(offset + 1) };
}

// Popisek dne: „Dnes“, „Včera“, jinak „neděle 8. 11.“
export function formatDayLabel(start, offset) {
  if (offset === 0) return 'Dnes';
  if (offset === -1) return 'Včera';
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(start);
}

// Rozsah osy X: zhruba hodinu před východem až hodinu po západu Slunce, na celé hodiny
export function daylightWindow({ start, end }) {
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, start, 1);
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, start, 1);
  if (!rise || !set) return { from: start.getTime(), to: end.getTime() };
  const hour = 60 * MIN;
  return {
    from: Math.max(start.getTime(), Math.round((rise.date.getTime() - hour) / hour) * hour),
    to: Math.min(end.getTime(), Math.round((set.date.getTime() + hour) / hour) * hour),
  };
}

// DB timestamp (UTC "YYYY-MM-DD HH:MM:SS") → epoch ms
export function parseDbTimestamp(ts) {
  return Date.parse(ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z'));
}

// Hranice „jasno“ v luxech pro okamžik t (epoch ms); null = Slunce příliš nízko
export function thresholdAt(t) {
  return clearThresholdLux(new Date(t));
}

// points: [{ t: epoch ms, lux }] seřazené podle času.
// Vrací celkový čas nad hranicí, úseky k výpisu a maximum.
export function summarizeDay(points, threshold = thresholdAt) {
  let totalMs = 0;
  const intervals = [];
  let max = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.lux == null) continue;
    if (!max || p.lux > max.lux) max = p;
    const thr = threshold(p.t);
    if (thr == null || p.lux < thr) continue;

    const next = points[i + 1];
    const span = Math.min(next ? next.t - p.t : MIN, MAX_SAMPLE_MIN * MIN);
    totalMs += span;

    const last = intervals[intervals.length - 1];
    if (last && p.t - last.end <= MERGE_GAP_MIN * MIN) last.end = p.t + span;
    else intervals.push({ start: p.t, end: p.t + span });
  }

  return {
    totalMinutes: Math.round(totalMs / MIN),
    intervals,
    listedIntervals: intervals.filter((iv) => iv.end - iv.start >= MIN_LISTED_MIN * MIN),
    max,
  };
}

// Nejnižší možná hranice jasno (Slunce 3° nad obzorem) je ~3,4 klx — tmavší měření nás nezajímají
export const MIN_CANDIDATE_LUX = 3000;

// Minuty nad hranicí jasno po pražských dnech, stejně jako summarizeDay.
// rows: [{ t: epoch s, b: lux, s: s do dalšího měření | null }] z getBrightnessSamples
export function clearMinutesByDay(rows) {
  const ms = {};
  for (const r of rows) {
    const t = r.t * 1000;
    const thr = thresholdAt(t);
    if (thr == null || r.b < thr) continue;
    const span = Math.min(r.s != null ? r.s * 1000 : MIN, MAX_SAMPLE_MIN * MIN);
    const key = dayKey(t);
    ms[key] = (ms[key] || 0) + span;
  }
  const out = {};
  for (const [key, v] of Object.entries(ms)) out[key] = Math.round(v / MIN);
  return out;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const timeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
});

export function formatClock(t) {
  return timeFormatter.format(new Date(t));
}
