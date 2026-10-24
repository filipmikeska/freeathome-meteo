// Ověření lokálního výpočtu Měsíce (src/lib/moon.js) proti nezávislým zdrojům:
//   1. Meeus, Astronomical Algorithms, kap. 49 — časy hlavních fází (vlastní implementace níže)
//   2. Publikované časy fází u zatmění (NASA/timeanddate)
//   3. Meeus kap. 47/48 (knihovna astronomia, nezávislá na astronomy-engine) — osvětlení a východy/západy
//   4. Konzistence getMoonData() den po dni, včetně dnů se změnou času
// Spuštění: npm run verify-moon
import { moonposition, nutation, sidereal, solar, base } from 'astronomia';
import {
  LAT, LON, getMoonData, quartersFrom, illuminationPercent, findRiseSet, pragueParts, pragueMidnight,
} from '../src/lib/moon.js';

const FROM = new Date(Date.UTC(2025, 0, 1));
const TO = new Date(Date.UTC(2028, 0, 1));
const MIN = 60000;

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
const fmt = (d) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

// --- Meeus, kap. 49 -------------------------------------------------------
const rad = (deg) => (deg * Math.PI) / 180;
const sin = (deg) => Math.sin(rad(deg));
const cos = (deg) => Math.cos(rad(deg));

// k: celé číslo = nov, +0.25 1. čtvrť, +0.5 úplněk, +0.75 posl. čtvrť; vrací JDE (TT)
function meeusPhaseJDE(k) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3;
  const frac = ((k % 1) + 1) % 1;

  const common = -0.00017 * sin(Om);
  if (frac === 0 || frac === 0.5) {
    const c = frac === 0
      ? [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208]
      : [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209];
    jde += c[0] * sin(Mp) + c[1] * E * sin(M) + c[2] * sin(2 * Mp) + c[3] * sin(2 * F)
      + c[4] * E * sin(Mp - M) + c[5] * E * sin(Mp + M) + c[6] * E * E * sin(2 * M)
      - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
      - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * Mp - M) + common - 0.00007 * sin(Mp + 2 * M)
      + 0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  } else {
    jde += -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp)
      + 0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M) + 0.00204 * E * E * sin(2 * M)
      - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp)
      - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F)
      - 0.00028 * E * E * sin(Mp + 2 * M) + 0.00027 * E * sin(2 * Mp + M) + common
      - 0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F) - 0.00004 * sin(Mp + M + 2 * F)
      + 0.00004 * sin(Mp - 2 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(3 * M)
      + 0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F) - 0.00002 * sin(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M)
      + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    jde += frac === 0.25 ? W : -W;
  }

  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T ** 2, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.00011],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.00006],
    [154.84 + 7.30686 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.00004],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023],
  ];
  for (const [arg, coef] of A) jde += coef * sin(arg);
  return jde;
}

const DELTA_T = 69; // s, TT − UT pro roky 2025–2028
const jdeToDate = (jde) => new Date((jde - 2440587.5) * 86400000 - DELTA_T * 1000);
const QUARTER_FRAC = { 'New Moon': 0, 'First Quarter': 0.25, 'Full Moon': 0.5, 'Last Quarter': 0.75 };

function meeusNearest(phase, date) {
  const years = (date - Date.UTC(2000, 0, 6)) / (365.25 * 86400000);
  const k = Math.round(years * 12.3685 - QUARTER_FRAC[phase]) + QUARTER_FRAC[phase];
  return jdeToDate(meeusPhaseJDE(k));
}

// --- Meeus kap. 47/48 přes astronomia: poloha, výška nad obzorem, osvětlení ---
const dateToJD = (date) => date.getTime() / 86400000 + 2440587.5; // UT
const EARTH_RADIUS = 6378.14; // km
const MOON_RADIUS = 1737.4; // km
const AU_KM = 149597870.7;
const REFRACTION = rad(34 / 60);

function meeusMoon(date) {
  const jd = dateToJD(date);
  const jde = jd + DELTA_T / 86400;
  const { lon, lat, range } = moonposition.position(jde);
  const [dPsi, dEps] = nutation.nutation(jde);
  const eps = nutation.meanObliquity(jde) + dEps;
  const lam = lon + dPsi;
  const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lam));
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lam));
  return { jd, jde, lam, lat, range, ra, dec };
}

// Výška horního okraje Měsíce nad obzorem (topocentricky, bez refrakce), v radiánech
function meeusUpperLimbAltitude(date) {
  const { jd, range, ra, dec } = meeusMoon(date);
  const theta = (sidereal.apparent(jd) / 86400) * 2 * Math.PI + rad(LON);
  const H = theta - ra;
  const phi = rad(LAT);
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const altTopo = alt - Math.asin(EARTH_RADIUS / range) * Math.cos(alt);
  return altTopo + Math.asin(MOON_RADIUS / range);
}

// Východ (+1) / západ (-1) v intervalu [start, end): průchod horního okraje výškou −34′ (refrakce)
function meeusRiseSet(direction, start, end) {
  const f = (t) => meeusUpperLimbAltitude(new Date(t)) + REFRACTION;
  const step = 10 * MIN;
  let t0 = start.getTime();
  let f0 = f(t0);
  while (t0 < end.getTime()) {
    const t1 = Math.min(t0 + step, end.getTime());
    const f1 = f(t1);
    if ((direction > 0 && f0 < 0 && f1 >= 0) || (direction < 0 && f0 > 0 && f1 <= 0)) {
      let a = t0;
      let b = t1;
      while (b - a > 1000) {
        const mid = (a + b) / 2;
        if ((f(mid) < 0) === (direction > 0)) a = mid; else b = mid;
      }
      return new Date((a + b) / 2);
    }
    t0 = t1;
    f0 = f1;
  }
  return null;
}

// Osvětlená část disku v % (Meeus 48.2–48.4)
function meeusIllumination(date) {
  const { jde, lam, lat, range } = meeusMoon(date);
  const T = base.J2000Century(jde);
  const sunLon = solar.apparentLongitude(T);
  const R = solar.radius(T) * AU_KM;
  const psi = Math.acos(Math.cos(lat) * Math.cos(lam - sunLon));
  const i = Math.atan2(R * Math.sin(psi), range - R * Math.cos(psi));
  return ((1 + Math.cos(i)) / 2) * 100;
}

// --- 1. Meeus: kontrola vlastní implementace a porovnání fází ---------------
console.log('\n1) Hlavní fáze vs. Meeus kap. 49');
{
  const jde = meeusPhaseJDE(-283); // Meeus, příklad 49.a: nov 1977-02-18 3:37:42 TD
  check('Meeus příklad 49.a (JDE 2443192.65118)', Math.abs(jde - 2443192.65118) < 0.00002, jde.toFixed(5));

  const quarters = quartersFrom(FROM, 200).filter((q) => q.date < TO);
  let maxDiff = 0;
  let worst = null;
  for (const q of quarters) {
    const diff = Math.abs(q.date - meeusNearest(q.phase, q.date)) / MIN;
    if (diff > maxDiff) { maxDiff = diff; worst = q; }
  }
  check(`${quarters.length} fází 2025–2027, max. rozdíl < 2 min`, maxDiff < 2,
    `max ${maxDiff.toFixed(2)} min (${worst.phase} ${fmt(worst.date)})`);

  let ordered = true;
  const ORDER = Object.keys(QUARTER_FRAC);
  for (let i = 1; i < quarters.length; i++) {
    if (ORDER.indexOf(quarters[i].phase) !== (ORDER.indexOf(quarters[i - 1].phase) + 1) % 4) ordered = false;
  }
  check('Fáze jdou v pořadí nov → 1. čtvrť → úplněk → posl. čtvrť', ordered);
}

// --- 2. Publikované časy (fáze při zatměních) ------------------------------
console.log('\n2) Publikované časy fází (zatmění)');
const PUBLISHED = [
  ['Full Moon', '2025-03-14T06:55Z', 'úplné zatmění Měsíce'],
  ['Full Moon', '2025-09-07T18:09Z', 'úplné zatmění Měsíce'],
  ['New Moon', '2026-02-17T12:01Z', 'prstencové zatmění Slunce'],
  ['Full Moon', '2026-03-03T11:38Z', 'úplné zatmění Měsíce'],
  ['New Moon', '2026-08-12T17:37Z', 'úplné zatmění Slunce (Španělsko)'],
  ['Full Moon', '2026-08-28T04:18Z', 'částečné zatmění Měsíce'],
];
for (const [phase, iso, label] of PUBLISHED) {
  const ref = new Date(iso);
  const found = quartersFrom(new Date(ref - 3 * 86400000), 4).find((q) => q.phase === phase);
  const diff = Math.abs(found.date - ref) / MIN;
  check(`${phase} ${iso.slice(0, 10)} (${label})`, diff < 3, `vypočteno ${fmt(found.date)}, rozdíl ${diff.toFixed(1)} min`);
}

// --- 3a. Osvětlení vs. Meeus -----------------------------------------------
console.log('\n3) Osvětlení a východ/západ vs. Meeus (astronomia)');
{
  let maxDiff = 0;
  let n = 0;
  for (let t = FROM.getTime(); t < TO.getTime(); t += 3600000) {
    const d = new Date(t);
    const diff = Math.abs(illuminationPercent(d) - meeusIllumination(d));
    maxDiff = Math.max(maxDiff, diff);
    n++;
  }
  check(`Osvětlení po hodinách (${n} bodů), max. rozdíl < 0,5 p. b.`, maxDiff < 0.5, `max ${maxDiff.toFixed(3)} p. b.`);

  const quarters = quartersFrom(FROM, 200).filter((q) => q.date < TO);
  const expected = { 'New Moon': 0, 'First Quarter': 50, 'Full Moon': 100, 'Last Quarter': 50 };
  const worst = Math.max(...quarters.map((q) => Math.abs(illuminationPercent(q.date) - expected[q.phase])));
  check('Osvětlení v okamžiku fáze ≈ 0 / 50 / 100 % (tolerance 1,5 p. b.)', worst < 1.5, `max odchylka ${worst.toFixed(2)} p. b.`);
}

// --- 3b. Východ/západ vs. Meeus --------------------------------------------
{
  for (const [dir, label] of [[+1, 'Východ'], [-1, 'Západ']]) {
    let maxDiff = 0;
    let days = 0;
    let missing = 0;
    const missingDetail = [];
    for (let day = new Date(FROM); day < TO; day = new Date(day.getTime() + 86400000)) {
      const start = pragueMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
      const end = pragueMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate() + 1);
      const ours = findRiseSet(dir, start, end);
      const theirs = meeusRiseSet(dir, start, end);
      days++;
      if (ours && theirs) {
        maxDiff = Math.max(maxDiff, Math.abs(ours - theirs) / MIN);
      } else if (ours || theirs) {
        // Přípustné jen když událost leží u půlnoci a druhá metoda ji zařadí do sousedního dne
        const t = ours || theirs;
        const nearMidnight = Math.min(t - start, end - t) < 10 * MIN;
        if (!nearMidnight) missing++;
        missingDetail.push(`${day.toISOString().slice(0, 10)}${nearMidnight ? '' : ' (!)'}`);
      }
    }
    check(`${label} Měsíce ${days} dní, max. rozdíl < 2 min`, maxDiff < 2, `max ${maxDiff.toFixed(2)} min`);
    check(`${label}: neshody v existenci události jen u půlnoci`, missing === 0,
      missingDetail.length ? missingDetail.join(', ') : 'žádné');
  }
}

// --- 4. getMoonData den po dni ----------------------------------------------
console.log('\n4) Konzistence getMoonData()');
{
  const VALID = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  const quarterDays = new Map();
  for (const q of quartersFrom(FROM, 200)) {
    const p = pragueParts(q.date);
    quarterDays.set(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, q.phase);
  }

  const problems = [];
  for (let t = FROM.getTime() + 11 * 3600000; t < TO.getTime(); t += 86400000) {
    const m = getMoonData(new Date(t));
    if (!VALID.includes(m.phase)) problems.push(`${m.date}: neznámá fáze ${m.phase}`);
    if (quarterDays.has(m.date) && quarterDays.get(m.date) !== m.phase) problems.push(`${m.date}: ${m.phase}, čekáno ${quarterDays.get(m.date)}`);
    if (!quarterDays.has(m.date) && QUARTER_FRAC[m.phase] !== undefined) problems.push(`${m.date}: ${m.phase} v den bez fáze`);
    if (!(m.illumination >= 0 && m.illumination <= 100)) problems.push(`${m.date}: osvětlení ${m.illumination}`);
    if (m.upcoming.length !== 4) problems.push(`${m.date}: ${m.upcoming.length} nadcházejících fází`);
    if (!m.moonrise && !m.moonset) problems.push(`${m.date}: chybí východ i západ`);
    for (const v of [m.moonrise, m.moonset]) if (v && !/^\d{2}:\d{2}$/.test(v)) problems.push(`${m.date}: čas ${v}`);
  }
  check('Polední stav pro každý den 2025–2027', problems.length === 0, problems.slice(0, 5).join('; ') || 'bez problémů');

  // Změna času: den má 23 h / 25 h, pražská půlnoc se musí posunout o hodinu
  for (const [y, mo, d, hours] of [[2026, 3, 29, 23], [2026, 10, 25, 25]]) {
    const len = (pragueMidnight(y, mo, d + 1) - pragueMidnight(y, mo, d)) / 3600000;
    check(`Délka dne ${d}. ${mo}. ${y} = ${hours} h`, len === hours, `${len} h`);
  }
  check('Pražská půlnoc 1. 1. 2026 = 23:00 UTC předchozího dne',
    pragueMidnight(2026, 1, 1).toISOString() === '2025-12-31T23:00:00.000Z');
  check('Pražská půlnoc 1. 7. 2026 = 22:00 UTC předchozího dne',
    pragueMidnight(2026, 7, 1).toISOString() === '2026-06-30T22:00:00.000Z');
}

console.log(`\nAktuální data: ${JSON.stringify(getMoonData(), null, 2)}`);
console.log(failures ? `\n${failures} kontrol selhalo` : '\nVšechny kontroly prošly');
process.exit(failures ? 1 : 0);
