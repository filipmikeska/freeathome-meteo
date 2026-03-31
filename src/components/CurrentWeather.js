'use client';

import {
  Thermometer,
  Sun,
  Wind,
  CloudRain,
  CloudOff,
  Droplets,
  Moon,
} from 'lucide-react';
import {
  formatTemperature,
  formatWindSpeed,
  formatBrightness,
  formatRain,
  getTemperatureColor,
  getTemperatureBg,
  getWindDescription,
  isDaytime,
} from '@/lib/utils';

function WeatherCard({ icon: Icon, label, value, detail, className, iconColor }) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {detail && (
        <div className="text-sm text-gray-500 mt-1">{detail}</div>
      )}
    </div>
  );
}

export default function CurrentWeather({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 p-5 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        Zatím nejsou k dispozici žádná data. Spusťte sběr dat.
      </div>
    );
  }

  const isDay = isDaytime();
  const raining = Number(data.rain) === 1;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <WeatherCard
        icon={Thermometer}
        label="Teplota"
        value={formatTemperature(data.temperature)}
        detail={Number(data.temperature) < 0 ? 'Pod bodem mrazu' : null}
        className={getTemperatureBg(data.temperature)}
        iconColor={getTemperatureColor(data.temperature)}
      />

      <WeatherCard
        icon={isDay ? Sun : Moon}
        label="Jas"
        value={formatBrightness(data.brightness)}
        detail={isDay ? 'Den' : 'Noc'}
        className="bg-yellow-50 border-yellow-200"
        iconColor="text-yellow-500"
      />

      <WeatherCard
        icon={Wind}
        label="Vítr"
        value={formatWindSpeed(data.windSpeed)}
        detail={getWindDescription(data.windSpeed)}
        className="bg-slate-50 border-slate-200"
        iconColor="text-slate-500"
      />

      <WeatherCard
        icon={raining ? Droplets : CloudOff}
        label="Déšť"
        value={formatRain(data.rain)}
        detail={raining ? 'Aktivní srážky' : 'Bez srážek'}
        className={
          raining
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-200'
        }
        iconColor={raining ? 'text-blue-500' : 'text-gray-400'}
      />
    </div>
  );
}
