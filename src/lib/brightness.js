// Průběh jasu během dne — výpočty pro okno „Průběh jasu“ (dlaždice Jas).
// Slouží hlavně k odhadu, kolik bylo slunce pro fotovoltaický ohřev vody.
import * as Astronomy from 'astronomy-engine';
import { LAT, LON, TZ, pragueParts, pragueMidnight } from './moon.js';

// Hranice „jasno“ v luxech. Za jasného listopadového dne jas vrcholí kolem 55–80 klx,
// za oblačného kolem 6–20 klx; v létě až ~117 klx.
export const CLEAR_SKY_LUX = 40000;

// Úseky nad hranicí: mezery do 5 min se slučují, úseky pod 10 min se nevypisují
const MERGE_GAP_MIN = 5;
const MIN_LISTED_MIN = 10;
// Jedno měření reprezentuje čas do dalšího, nejvýš však tolik (výpadek sběru se nepočítá)
const MAX_SAMPLE_MIN = 10;

const MIN = 60000;
const observer = new Astronomy.Observer(LAT, LON, 200);

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

// points: [{ t: epoch ms, lux }] seřazené podle času.
// Vrací celkový čas nad hranicí, úseky k výpisu a maximum.
export function summarizeDay(points, threshold = CLEAR_SKY_LUX) {
  let totalMs = 0;
  const intervals = [];
  let max = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.lux == null) continue;
    if (!max || p.lux > max.lux) max = p;
    if (p.lux < threshold) continue;

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
