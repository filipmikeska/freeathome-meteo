// Open-Meteo WMO Weather Codes → české popisky a ikony (Lucide React)
// https://open-meteo.com/en/docs#weathervariables

export const WEATHER_CODES = {
  0:  { label: 'Jasno',                    icon: 'Sun',          night: 'Moon' },
  1:  { label: 'Převážně jasno',           icon: 'Sun',          night: 'Moon' },
  2:  { label: 'Polojasno',                icon: 'CloudSun',     night: 'CloudMoon' },
  3:  { label: 'Zataženo',                 icon: 'Cloud',        night: 'Cloud' },
  45: { label: 'Mlha',                     icon: 'CloudFog',     night: 'CloudFog' },
  48: { label: 'Mrznoucí mlha',            icon: 'CloudFog',     night: 'CloudFog' },
  51: { label: 'Mrholení slabé',           icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  53: { label: 'Mrholení mírné',           icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  55: { label: 'Mrholení silné',           icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  56: { label: 'Mrznoucí mrholení',        icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  57: { label: 'Mrznoucí mrholení silné',  icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  61: { label: 'Déšť slabý',              icon: 'CloudRain',    night: 'CloudRain' },
  63: { label: 'Déšť mírný',              icon: 'CloudRain',    night: 'CloudRain' },
  65: { label: 'Déšť silný',              icon: 'CloudRain',    night: 'CloudRain' },
  66: { label: 'Mrznoucí déšť',           icon: 'CloudRain',    night: 'CloudRain' },
  67: { label: 'Mrznoucí déšť silný',     icon: 'CloudRain',    night: 'CloudRain' },
  71: { label: 'Sněžení slabé',           icon: 'Snowflake',    night: 'Snowflake' },
  73: { label: 'Sněžení mírné',           icon: 'Snowflake',    night: 'Snowflake' },
  75: { label: 'Sněžení silné',           icon: 'Snowflake',    night: 'Snowflake' },
  77: { label: 'Sněhové zrno',            icon: 'Snowflake',    night: 'Snowflake' },
  80: { label: 'Přeháňky slabé',          icon: 'CloudRain',    night: 'CloudRain' },
  81: { label: 'Přeháňky mírné',          icon: 'CloudRain',    night: 'CloudRain' },
  82: { label: 'Přeháňky silné',          icon: 'CloudRain',    night: 'CloudRain' },
  85: { label: 'Sněhové přeháňky',        icon: 'Snowflake',    night: 'Snowflake' },
  86: { label: 'Sněhové přeháňky silné',  icon: 'Snowflake',    night: 'Snowflake' },
  95: { label: 'Bouřka',                  icon: 'CloudLightning', night: 'CloudLightning' },
  96: { label: 'Bouřka s krupobitím',     icon: 'CloudLightning', night: 'CloudLightning' },
  99: { label: 'Bouřka silná s krupobitím', icon: 'CloudLightning', night: 'CloudLightning' },
};

export function getWeatherInfo(code, isNight = false) {
  const info = WEATHER_CODES[code] || { label: 'Neznámo', icon: 'Cloud', night: 'Cloud' };
  return {
    label: info.label,
    icon: isNight ? info.night : info.icon,
  };
}

// Yr.no symbol_code → WMO code mapping
const YR_SYMBOL_MAP = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightrainshowers: 80,
  rainshowers: 81,
  heavyrainshowers: 82,
  lightsleet: 56,
  sleet: 66,
  heavysleet: 67,
  lightsleetshowers: 56,
  sleetshowers: 66,
  heavysleetshowers: 67,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightsnowshowers: 85,
  snowshowers: 85,
  heavysnowshowers: 86,
  lightrainandthunder: 95,
  rainandthunder: 95,
  heavyrainandthunder: 99,
  sleetandthunder: 95,
  snowandthunder: 95,
  lightrainshowersandthunder: 95,
  rainshowersandthunder: 96,
  heavyrainshowersandthunder: 99,
  lightsleetandthunder: 95,
  heavysleetandthunder: 95,
  lightsnowandthunder: 95,
  heavysnowandthunder: 95,
  lightssleetshowersandthunder: 95,
  sleetshowersandthunder: 95,
  heavysleetshowersandthunder: 95,
  lightsnowshowersandthunder: 95,
  snowshowersandthunder: 95,
  heavysnowshowersandthunder: 95,
};

export function yrSymbolToWmoCode(symbolCode) {
  const base = symbolCode.replace(/_(day|night|polartwilight)$/, '');
  const isNight = symbolCode.endsWith('_night');
  return { wmoCode: YR_SYMBOL_MAP[base] ?? 3, isNight };
}

// Mapování názvu ikony na komponentu se provede v komponentě
export const ICON_MAP = {
  Sun: 'Sun',
  Moon: 'Moon',
  CloudSun: 'CloudSun',
  CloudMoon: 'CloudMoon',
  Cloud: 'Cloud',
  CloudFog: 'CloudFog',
  CloudDrizzle: 'CloudDrizzle',
  CloudRain: 'CloudRain',
  Snowflake: 'Snowflake',
  CloudLightning: 'CloudLightning',
};
