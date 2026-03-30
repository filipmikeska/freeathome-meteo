'use client';

import { useState } from 'react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, Snowflake, CloudLightning,
  Droplets, Wind, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getWeatherInfo } from '@/lib/weather-codes';
import ForecastDetail from './ForecastDetail';

const ICONS = {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog,
  CloudDrizzle, CloudRain, Snowflake, CloudLightning,
};

function getDayLabel(dateStr) {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Dnes';
  if (isTomorrow(date)) return 'Zitra';
  return format(date, 'EEEE', { locale: cs });
}

function DayRow({ day, hourly, isExpanded, onToggle }) {
  const weather = getWeatherInfo(day.weatherCode);
  const IconComponent = ICONS[weather.icon] || Cloud;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        {/* Ikona */}
        <div className="w-10 flex justify-center">
          <IconComponent className="h-6 w-6 text-blue-500" />
        </div>

        {/* Den a popis */}
        <div className="flex-1 text-left ml-3">
          <div className="font-medium text-gray-900 capitalize">
            {getDayLabel(day.date)}
          </div>
          <div className="text-xs text-gray-500">
            {weather.label} &middot; {format(parseISO(day.date), 'd.M.', { locale: cs })}
          </div>
        </div>

        {/* Srážky */}
        {day.precipitation > 0 && (
          <div className="flex items-center gap-1 mr-4">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-sm text-blue-500">
              {day.precipitation.toFixed(1)} mm
            </span>
          </div>
        )}

        {/* Vítr */}
        <div className="flex items-center gap-1 mr-4 w-16">
          <Wind className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm text-gray-500">
            {Math.round(day.windMax / 3.6)} m/s
          </span>
        </div>

        {/* Min/Max teplota */}
        <div className="flex items-center gap-2 w-24 justify-end mr-2">
          <span className="text-sm text-blue-500 font-medium">
            {Math.round(day.tempMin)}°
          </span>
          <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-blue-300 to-red-300" />
          <span className="text-sm text-red-500 font-medium">
            {Math.round(day.tempMax)}°
          </span>
        </div>

        {/* Expand ikona */}
        <div className="ml-2">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Hodinový detail */}
      {isExpanded && hourly && (
        <ForecastDetail hourly={hourly} sunrise={day.sunrise} sunset={day.sunset} />
      )}
    </div>
  );
}

export default function ForecastCard({ forecast, isLoading }) {
  const [expandedDay, setExpandedDay] = useState(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!forecast?.daily) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
        Predpoved neni k dispozici
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {forecast.daily.map((day) => (
        <DayRow
          key={day.date}
          day={day}
          hourly={forecast.hourly?.[day.date]}
          isExpanded={expandedDay === day.date}
          onToggle={() =>
            setExpandedDay(expandedDay === day.date ? null : day.date)
          }
        />
      ))}
    </div>
  );
}
