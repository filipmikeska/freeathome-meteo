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
  if (temp < 0) return 'bg-blue-50 border-blue-200';
  if (temp < 10) return 'bg-cyan-50 border-cyan-200';
  if (temp < 25) return 'bg-green-50 border-green-200';
  if (temp < 35) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
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
  const date = new Date(timestamp);
  if (range === '24h') return format(date, 'HH:mm', { locale: cs });
  if (range === '7d') return format(date, 'EEE HH:mm', { locale: cs });
  return format(date, 'd.M.', { locale: cs });
}

// Formát timestamp pro tooltip
export function formatTooltipTime(timestamp) {
  return format(new Date(timestamp), 'd.M.yyyy HH:mm', { locale: cs });
}

// Zjistí, jestli je den nebo noc (přibližně)
export function isDaytime() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 21;
}
