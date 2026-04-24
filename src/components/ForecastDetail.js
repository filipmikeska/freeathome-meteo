'use client';

import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, Snowflake, CloudLightning,
  Droplets, Wind,
} from 'lucide-react';
import { getWeatherInfo } from '@/lib/weather-codes';

const ICONS = {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, Snowflake, CloudLightning,
};

function isNightTime(timeStr, sunrise, sunset) {
  if (!sunrise || !sunset) return false;
  const sunriseTime = sunrise.slice(11, 16);
  const sunsetTime = sunset.slice(11, 16);
  return timeStr < sunriseTime || timeStr >= sunsetTime;
}

export default function ForecastDetail({ hourly, sunrise, sunset }) {
  if (!hourly?.length) return null;

  // Zobrazíme každé 3 hodiny pro přehlednost
  const filtered = hourly.filter((_, i) => i % 3 === 0);

  // Zjistit, zda data obsahují pocitovou teplotu a pravděpodobnost srážek
  const hasFeelsLike = filtered.some((h) => h.feelsLike != null);
  const hasPrecipProb = filtered.some((h) => h.precipitationProbability != null);

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs text-gray-400">
        {hasFeelsLike ? (
          <span><strong className="text-gray-700 dark:text-gray-200">teplota</strong>, <span className="font-light">pocitová</span></span>
        ) : (
          <span><strong className="text-gray-700 dark:text-gray-200">teplota</strong></span>
        )}
        <div className="flex items-center gap-1">
          <Wind className="h-3 w-3" />
          <span>= vítr (m/s)</span>
        </div>
        {hasPrecipProb && (
          <div className="flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            <span>= srážky (%)</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {filtered.map((hour) => {
            const isNight = isNightTime(hour.time, sunrise, sunset);
            const weather = getWeatherInfo(hour.weatherCode, isNight);
            const IconComponent = ICONS[weather.icon] || Cloud;

            return (
              <div
                key={hour.time}
                className="flex flex-col items-center px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors min-w-[60px]"
              >
                {/* Čas */}
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {hour.time}
                </span>

                {/* Ikona */}
                <IconComponent
                  className={`h-5 w-5 my-1.5 ${
                    isNight ? 'text-indigo-400' : 'text-yellow-500'
                  }`}
                />

                {/* Teplota */}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {Math.round(hour.temperature)}°
                </span>

                {/* Pocitová teplota */}
                {hasFeelsLike && (
                  <span className="text-xs text-gray-400" title="Pocitová teplota">
                    {Math.round(hour.feelsLike)}°
                  </span>
                )}

                {/* Srážky */}
                {hour.precipitation > 0 && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                    {hour.precipitation.toFixed(1)} mm
                  </span>
                )}

                {/* Vítr */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Wind className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(hour.windSpeed / 3.6)}
                  </span>
                </div>

                {/* Pravděpodobnost srážek */}
                {hasPrecipProb && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Droplets className="h-3 w-3 text-blue-400" />
                    <span className={`text-xs ${
                      hour.precipitationProbability > 50
                        ? 'text-blue-500 dark:text-blue-400 font-medium'
                        : 'text-gray-400'
                    }`}>
                      {hour.precipitationProbability}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
