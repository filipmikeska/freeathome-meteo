import { format, subHours, subDays, startOfHour, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';

// Formátování teploty
export function formatTemperature(value) {
  if (value == null) return '--';
  return `${Number(value).toFixed(1)} °C`;
}

// Formátování rychlosti větru
export function formatWindSpeed(value) {
  if (value == null) return '--';
  return `${Number(value).toFixed(1)} m/s`;
}

// Formátování jasu
export function formatBrightness(value) {
  if (value == null) return '--';
  const num = Number(value);
  if (num >= 1000) return `${(num / 1000).toFixed(1)} klux`;
  return `${num.toFixed(0)} lux`;
}

// Formátování deště
export function formatRain(value) {
  return Number(value) === 1 ? 'Prší' : 'Neprší';
}

// Barva podle teploty
export function getTemperatureColor(value) {
  const temp = Number(value);
  if (temp < 0) return 'text-blue-500';
  if (temp < 10) return 'text-cyan-500';
  if (temp < 25) return 'text-green-500';
  if (temp < 35) return 'text-orange-500';
  return 'text-red-500';
}

// Barva pozadí karty podle teploty
export function getTemperatureBg(value) {
  const temp = Number(value);
  if (temp < 0) return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
  if (temp < 10) return 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950 dark:border-cyan-800';
  if (temp < 25) return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
  if (temp < 35) return 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800';
  return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
}

// Beaufortova stupnice — popis větru
export function getWindDescription(ms) {
  const speed = Number(ms);
  if (speed < 0.3) return 'Bezvětří';
  if (speed < 1.6) return 'Vánek';
  if (speed < 3.4) return 'Slabý vítr';
  if (speed < 5.5) return 'Mírný vítr';
  if (speed < 8.0) return 'Dosti čerstvý';
  if (speed < 10.8) return 'Čerstvý vítr';
  if (speed < 13.9) return 'Silný vítr';
  if (speed < 17.2) return 'Prudký vítr';
  return 'Vichřice';
}

// Konvertuje Date na DB-kompatibilní string "YYYY-MM-DD HH:MM:SS" (UTC).
// V databázi jsou timestampy ukládány tímto formátem (přes SQLite datetime('now')).
// ISO formát s 'T' a 'Z' by způsobil chybné string-porovnání v BETWEEN.
function toDbDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Výpočet časových rozsahů pro grafy
export function getTimeRange(range) {
  const now = new Date();
  switch (range) {
    case '24h':
      return { from: toDbDateTime(subHours(now, 24)), to: toDbDateTime(now) };
    case '7d':
      return { from: toDbDateTime(subDays(now, 7)), to: toDbDateTime(now) };
    case '30d':
      return { from: toDbDateTime(subDays(now, 30)), to: toDbDateTime(now) };
    default:
      return { from: toDbDateTime(subHours(now, 24)), to: toDbDateTime(now) };
  }
}

// Formát času pro grafy
export function formatChartTime(timestamp, range) {
  const date = parseUTC(timestamp);
  if (range === '24h') return format(date, 'HH:mm', { locale: cs });
  if (range === '7d') return format(date, 'EEE HH:mm', { locale: cs });
  return format(date, 'd.M.', { locale: cs });
}

// Parse DB timestamp (UTC) correctly
function parseUTC(timestamp) {
  if (!timestamp) return new Date();
  // DB stores "2026-03-31 16:37:02" in UTC — append Z so JS treats it as UTC
  const iso = timestamp.replace(' ', 'T') + (timestamp.includes('Z') ? '' : 'Z');
  return new Date(iso);
}

// Formát timestamp pro tooltip
export function formatTooltipTime(timestamp) {
  return format(parseUTC(timestamp), 'd.M.yyyy HH:mm', { locale: cs });
}

// --- Solární výpočty pro Pacetluky (49.3794°N, 17.5658°E) ---

const LAT = 49.3794;
const LON = 17.5658;
const DEG = Math.PI / 180;

// Jas při jasné obloze podle výšky Slunce: [výška °, klx].
// Empirická obálka z vlastních měření (95. percentil hodinových maxim, duben–listopad 2026).
// Nad ~50° už čidlo saturuje kolem 115–117 klx.
const CLEAR_SKY_KLX = [
  [0, 0], [2, 3.3], [6, 9.4], [10, 31.5], [14, 42.4], [18, 58.7], [22, 71.6], [26, 79.6],
  [30, 87.6], [34, 97.3], [38, 100.8], [42, 108.5], [46, 110.8], [50, 113], [58, 114.9],
];

// Hranice „Jasno“: aspoň 70 % jasu jasné oblohy. Pod 3° nad obzorem se jasno nevyhodnocuje.
export const CLEAR_RATIO = 0.7;
const MIN_CLEAR_ELEVATION = 3;

// Výška Slunce nad obzorem (stupně), bez refrakce. Vzorce NOAA vč. časové rovnice,
// odchylka od přesného výpočtu do ~0,2°.
export function getSolarElevation(date) {
  const g = ((2 * Math.PI) / 365) * ((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000);
  const declination =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // Časová rovnice v minutách
  const eot =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const hourAngle = ((minutesUTC + eot + 4 * LON) / 4 - 180) * DEG;

  const sinElev =
    Math.sin(LAT * DEG) * Math.sin(declination) +
    Math.cos(LAT * DEG) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(sinElev) / DEG;
}

// Jas při jasné obloze pro daný okamžik (lux), lineární interpolace v tabulce
export function clearSkyLux(date) {
  const elev = getSolarElevation(date);
  if (elev <= 0) return 0;
  for (let i = 1; i < CLEAR_SKY_KLX.length; i++) {
    const [b, vb] = CLEAR_SKY_KLX[i];
    if (elev <= b) {
      const [a, va] = CLEAR_SKY_KLX[i - 1];
      return (va + ((vb - va) * (elev - a)) / (b - a)) * 1000;
    }
  }
  return CLEAR_SKY_KLX[CLEAR_SKY_KLX.length - 1][1] * 1000;
}

// Hranice „Jasno“ v luxech pro daný okamžik; null, když je Slunce příliš nízko
export function clearThresholdLux(date) {
  if (getSolarElevation(date) < MIN_CLEAR_ELEVATION) return null;
  return CLEAR_RATIO * clearSkyLux(date);
}

// Zjistí stav oblohy z naměřeného jasu (poměr k jasu jasné oblohy ve stejné výšce Slunce)
export function getSkyCondition(brightnessLux, date = new Date()) {
  const clear = clearSkyLux(date);
  if (clear <= 0) {
    return { label: 'Noc', icon: 'night', isDay: false, kt: 0 };
  }

  const kt = Math.min(Number(brightnessLux) / clear, 1.2);

  if (kt >= CLEAR_RATIO) return { label: 'Jasno', icon: 'clear', isDay: true, kt };
  if (kt > 0.4) return { label: 'Polojasno', icon: 'partlyCloudy', isDay: true, kt };
  if (kt > 0.15) return { label: 'Oblačno', icon: 'cloudy', isDay: true, kt };
  return { label: 'Zataženo', icon: 'overcast', isDay: true, kt };
}

// Zjistí, jestli je den nebo noc
export function isDaytime(date = new Date()) {
  return getSolarElevation(date) > 0;
}
