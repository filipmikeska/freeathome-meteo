'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Thermometer,
  Sun,
  Wind,
  CloudOff,
  Droplets,
  Moon,
  Cloud,
  CloudSun,
  TrendingDown,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  formatTemperature,
  formatWindSpeed,
  formatBrightness,
  formatRain,
  getTemperatureColor,
  getTemperatureBg,
  getWindDescription,
  getSkyCondition,
  formatTooltipTime,
} from '@/lib/utils';
import { useTodayStats } from '@/hooks/useWeatherData';

const SKY_ICONS = {
  night: Moon,
  clear: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  overcast: Cloud,
};

function formatTime(timestamp) {
  if (!timestamp) return '--:--';
  const iso = timestamp.replace(' ', 'T') + (timestamp.includes('Z') ? '' : 'Z');
  const d = new Date(iso);
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function StatRow({ label, icon: Icon, value, time, color }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
        <span className="text-xs text-gray-400 flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {time}
        </span>
      </div>
    </div>
  );
}

function DetailPopup({ type, stats, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  if (!stats) return null;

  let content;
  if (type === 'temperature') {
    const { min, max } = stats.temperature;
    content = (
      <>
        <StatRow
          label="Max"
          icon={TrendingUp}
          value={max ? formatTemperature(max.value) : '--'}
          time={max ? formatTime(max.timestamp) : '--'}
          color="text-red-500"
        />
        <StatRow
          label="Min"
          icon={TrendingDown}
          value={min ? formatTemperature(min.value) : '--'}
          time={min ? formatTime(min.timestamp) : '--'}
          color="text-blue-500"
        />
      </>
    );
  } else if (type === 'brightness') {
    const { min, max } = stats.brightness;
    content = (
      <>
        <StatRow
          label="Max"
          icon={TrendingUp}
          value={max ? formatBrightness(max.value) : '--'}
          time={max ? formatTime(max.timestamp) : '--'}
          color="text-yellow-500"
        />
        <StatRow
          label="Min"
          icon={TrendingDown}
          value={min ? formatBrightness(min.value) : '--'}
          time={min ? formatTime(min.timestamp) : '--'}
          color="text-gray-400"
        />
      </>
    );
  } else if (type === 'wind') {
    const { min, max } = stats.wind;
    content = (
      <>
        <StatRow
          label="Max"
          icon={TrendingUp}
          value={max ? formatWindSpeed(max.value) : '--'}
          time={max ? formatTime(max.timestamp) : '--'}
          color="text-indigo-500"
        />
        <StatRow
          label="Min"
          icon={TrendingDown}
          value={min ? formatWindSpeed(min.value) : '--'}
          time={min ? formatTime(min.timestamp) : '--'}
          color="text-gray-400"
        />
      </>
    );
  } else if (type === 'rain') {
    const rainMins = stats.rain.totalMinutes || 0;
    content = (
      <div className="py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Srážky dnes</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {rainMins > 0 ? `${rainMins} min` : 'Žádné'}
          </span>
        </div>
        {rainMins > 0 && stats.rain.totalMeasurements > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Podíl dne</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {Math.round((rainMins / stats.rain.totalMeasurements) * 100)} %
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 animate-slide-up"
    >
      <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
        Dnes
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {content}
      </div>
    </div>
  );
}

function WeatherCard({ icon: Icon, label, value, detail, className, iconColor, type, stats }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left rounded-xl border p-5 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] ${className}`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        {detail && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{detail}</div>
        )}
      </button>
      {open && (
        <DetailPopup type={type} stats={stats} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

export default function CurrentWeather({ data, isLoading }) {
  const { stats } = useTodayStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Zatím nejsou k dispozici žádná data. Spusťte sběr dat.
      </div>
    );
  }

  const sky = getSkyCondition(data.brightness);
  const raining = Number(data.rain) === 1;
  const SkyIcon = SKY_ICONS[sky.icon] || Sun;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <WeatherCard
        icon={Thermometer}
        label="Teplota"
        value={formatTemperature(data.temperature)}
        detail={(() => {
          const t = Number(data.temperature);
          if (t < 0) return 'Pod bodem mrazu';
          if (t < 10) return 'Chladno';
          if (t < 25) return 'Příjemně';
          if (t < 35) return 'Horko';
          return 'Vedro';
        })()}
        className={getTemperatureBg(data.temperature)}
        iconColor={getTemperatureColor(data.temperature)}
        type="temperature"
        stats={stats}
      />

      <WeatherCard
        icon={SkyIcon}
        label="Jas"
        value={formatBrightness(data.brightness)}
        detail={sky.label}
        className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
        iconColor={sky.isDay ? 'text-yellow-500' : 'text-indigo-400'}
        type="brightness"
        stats={stats}
      />

      <WeatherCard
        icon={Wind}
        label="Vítr"
        value={formatWindSpeed(data.windSpeed)}
        detail={getWindDescription(data.windSpeed)}
        className="bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
        iconColor="text-slate-500"
        type="wind"
        stats={stats}
      />

      <WeatherCard
        icon={raining ? Droplets : CloudOff}
        label="Déšť"
        value={formatRain(data.rain)}
        detail={raining ? 'Aktivní srážky' : 'Bez srážek'}
        className={
          raining
            ? 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-800'
            : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
        }
        iconColor={raining ? 'text-blue-500' : 'text-gray-400'}
        type="rain"
        stats={stats}
      />
    </div>
  );
}
