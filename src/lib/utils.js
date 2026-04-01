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

// Výpočet časových rozsahů pro grafy
export function getTimeRange(range) {
  const now = new Date();
  switch (range) {
    case '24h':
      return { from: subHours(now, 24).toISOString(), to: now.toISOString() };
    case '7d':
      return { from: subDays(now, 7).toISOString(), to: now.toISOString() };
    case '30d':
      return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
    default:
      return { from: subHours(now, 24).toISOString(), to: now.toISOString() };
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

// Měsíční špičky jasu při jasné obloze (klx) — zdroj: ČHMÚ, PVGIS
const PEAK_KLX = [0, 30, 42, 66, 84, 102, 114, 120, 108, 84, 54, 34, 24];

// Výška slunce nad obzorem (stupně)
function getSolarElevation(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;

  // Deklinace slunce
  const declination = -23.45 * Math.cos(DEG * (360 / 365) * (dayOfYear + 10));

  // Hodinový úhel (solar hour angle)
  const solarNoonUTC = 12 - LON / 15;
  const hourAngle = (hourUTC - solarNoonUTC) * 15;

  // Výška slunce
  const sinElev =
    Math.sin(LAT * DEG) * Math.sin(declination * DEG) +
    Math.cos(LAT * DEG) * Math.cos(declination * DEG) * Math.cos(hourAngle * DEG);

  return Math.asin(sinElev) / DEG;
}

// Maximální výška slunce v poledne pro daný den
function getMaxElevation(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.45 * Math.cos(DEG * (360 / 365) * (dayOfYear + 10));
  return 90 - LAT + declination;
}

// Teoretický max jasu pro daný okamžik při jasné obloze (klx)
function getTheoreticalMax(date) {
  const elev = getSolarElevation(date);
  if (elev <= 0) return 0;

  const month = date.getMonth() + 1;
  const peak = PEAK_KLX[month];
  const maxElev = getMaxElevation(date);

  if (maxElev <= 0) return 0;
  return peak * Math.sin(elev * DEG) / Math.sin(maxElev * DEG);
}

// Zjistí stav oblohy z naměřeného jasu
export function getSkyCondition(brightnessLux, date = new Date()) {
  const elev = getSolarElevation(date);

  if (elev <= 0) {
    return { label: 'Noc', icon: 'night', isDay: false, kt: 0 };
  }

  const theorMax = getTheoreticalMax(date);
  if (theorMax <= 0) {
    return { label: 'Noc', icon: 'night', isDay: false, kt: 0 };
  }

  const measuredKlx = Number(brightnessLux) / 1000;
  const kt = Math.min(measuredKlx / theorMax, 1.2);

  if (kt > 0.7) return { label: 'Jasno', icon: 'clear', isDay: true, kt };
  if (kt > 0.4) return { label: 'Polojasno', icon: 'partlyCloudy', isDay: true, kt };
  if (kt > 0.15) return { label: 'Oblačno', icon: 'cloudy', isDay: true, kt };
  return { label: 'Zataženo', icon: 'overcast', isDay: true, kt };
}

// Zjistí, jestli je den nebo noc
export function isDaytime(date = new Date()) {
  return getSolarElevation(date) > 0;
}
