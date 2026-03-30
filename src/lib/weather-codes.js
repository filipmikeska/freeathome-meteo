// Open-Meteo WMO Weather Codes → české popisky a ikony (Lucide React)
// https://open-meteo.com/en/docs#weathervariables

export const WEATHER_CODES = {
  0:  { label: 'Jasno',              icon: 'Sun',          night: 'Moon' },
  1:  { label: 'Prevazne jasno',     icon: 'Sun',          night: 'Moon' },
  2:  { label: 'Polojasno',          icon: 'CloudSun',     night: 'CloudMoon' },
  3:  { label: 'Zatazeno',           icon: 'Cloud',        night: 'Cloud' },
  45: { label: 'Mlha',               icon: 'CloudFog',     night: 'CloudFog' },
  48: { label: 'Mrznouci mlha',      icon: 'CloudFog',     night: 'CloudFog' },
  51: { label: 'Mrholeni slabe',     icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  53: { label: 'Mrholeni mirne',     icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  55: { label: 'Mrholeni silne',     icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  56: { label: 'Mrznouci mrholeni',  icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  57: { label: 'Mrznouci mrholeni silne', icon: 'CloudDrizzle', night: 'CloudDrizzle' },
  61: { label: 'Dest slaby',         icon: 'CloudRain',    night: 'CloudRain' },
  63: { label: 'Dest mirny',         icon: 'CloudRain',    night: 'CloudRain' },
  65: { label: 'Dest silny',         icon: 'CloudRain',    night: 'CloudRain' },
  66: { label: 'Mrznouci dest',      icon: 'CloudRain',    night: 'CloudRain' },
  67: { label: 'Mrznouci dest silny',icon: 'CloudRain',    night: 'CloudRain' },
  71: { label: 'Snezeni slabe',      icon: 'Snowflake',    night: 'Snowflake' },
  73: { label: 'Snezeni mirne',      icon: 'Snowflake',    night: 'Snowflake' },
  75: { label: 'Snezeni silne',      icon: 'Snowflake',    night: 'Snowflake' },
  77: { label: 'Snehove zrno',       icon: 'Snowflake',    night: 'Snowflake' },
  80: { label: 'Prehanky slabe',     icon: 'CloudRain',    night: 'CloudRain' },
  81: { label: 'Prehanky mirne',     icon: 'CloudRain',    night: 'CloudRain' },
  82: { label: 'Prehanky silne',     icon: 'CloudRain',    night: 'CloudRain' },
  85: { label: 'Snehove prehanky',   icon: 'Snowflake',    night: 'Snowflake' },
  86: { label: 'Snehove prehanky silne', icon: 'Snowflake', night: 'Snowflake' },
  95: { label: 'Bourka',             icon: 'CloudLightning', night: 'CloudLightning' },
  96: { label: 'Bourka s krupobitim', icon: 'CloudLightning', night: 'CloudLightning' },
  99: { label: 'Bourka silna s krupobitim', icon: 'CloudLightning', night: 'CloudLightning' },
};

export function getWeatherInfo(code, isNight = false) {
  const info = WEATHER_CODES[code] || { label: 'Neznamo', icon: 'Cloud', night: 'Cloud' };
  return {
    label: info.label,
    icon: isNight ? info.night : info.icon,
  };
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
