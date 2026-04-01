'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, CalendarDays, CloudSun, BarChart3 } from 'lucide-react';
import CurrentWeather from './CurrentWeather';
import DateRangePicker from './DateRangePicker';
import InstallLink from './InstallLink';
import { useCurrentWeather, useWeatherHistory, useForecast, useForecastYr, useMoonData } from '@/hooks/useWeatherData';
import { formatTooltipTime } from '@/lib/utils';

// Dynamic imports — těžké komponenty se načtou až když jsou potřeba
const WeatherChart = dynamic(() => import('./WeatherChart'), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Načítám graf...</div>
      </div>
    </div>
  ),
  ssr: false,
});

const ForecastCard = dynamic(() => import('./ForecastCard'), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="animate-pulse space-y-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  ),
});

const SunTimes = dynamic(() => import('./SunTimes'), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
      <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  ),
});

const ForecastAccuracy = dynamic(() => import('./ForecastAccuracy'), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4" />
      <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  ),
});

const MoonPhase = dynamic(() => import('./MoonPhase'), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
      <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  ),
});

const TABS = [
  { id: 'weather', label: 'Počasí', icon: CloudSun },
  { id: 'forecast', label: 'Předpověď', icon: CalendarDays },
];

export default function Dashboard() {
  const [tab, setTab] = useState('weather');
  const [range, setRange] = useState('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { current, isLoading: currentLoading } = useCurrentWeather();
  const { forecast, isLoading: forecastLoading } = useForecast();
  const { forecastYr, isLoading: forecastYrLoading } = useForecastYr();
  const { moon, isLoading: moonLoading } = useMoonData();

  // Pro custom rozsah použijeme from/to, jinak range
  const historyParams =
    range === 'custom' && customFrom && customTo
      ? { range: 'custom', from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() }
      : { range };

  const { history, isLoading: historyLoading } = useWeatherHistory(
    historyParams.range === 'custom' ? '24h' : historyParams.range,
    historyParams.from,
    historyParams.to
  );

  const handleCustomChange = (field, value) => {
    if (field === 'from') setCustomFrom(value);
    if (field === 'to') setCustomTo(value);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
      {/* Záložky */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ===== Karta: Počasí ===== */}
      {tab === 'weather' && (
        <>
          {/* Aktuální data */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Aktuální počasí
              </h2>
              {current?.timestamp && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{formatTooltipTime(current.timestamp)}</span>
                </div>
              )}
            </div>
            <CurrentWeather data={current} isLoading={currentLoading} />

            {/* Slunce a Měsíc */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {forecast?.daily && (
                <SunTimes forecast={forecast} brightness={current?.brightness} />
              )}
              <MoonPhase moon={moon} isLoading={moonLoading} />
            </div>
          </section>

          {/* Grafy */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Historie měření
              </h2>
              <DateRangePicker
                range={range}
                onRangeChange={setRange}
                customFrom={customFrom}
                customTo={customTo}
                onCustomChange={handleCustomChange}
              />
            </div>
            <WeatherChart
              data={history?.data}
              range={range}
              isLoading={historyLoading}
            />
          </section>
        </>
      )}

      {/* ===== Karta: Předpověď ===== */}
      {tab === 'forecast' && (
        <>
          {/* Open-Meteo */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Předpověď na 7 dní
                </h2>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                Zdroj: Open-Meteo (ECMWF)
              </span>
            </div>
            <ForecastCard forecast={forecast} isLoading={forecastLoading} />
          </section>

          {/* Yr.no */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Předpověď na 7 dní
                </h2>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                Zdroj: Yr.no (MET Norway)
              </span>
            </div>
            <ForecastCard forecast={forecastYr} isLoading={forecastYrLoading} />
          </section>

          {/* Přesnost předpovědí */}
          <section>
            <ForecastAccuracy />
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="text-center text-sm text-gray-400 dark:text-gray-500 pb-4">
        Data z meteostanice ABB free@home WS-1 &middot;
        Předpověď: Open-Meteo.com, Yr.no &middot;
        Aktualizace každých{' '}
        {Math.round((parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL || '60000') / 1000))} s
        <br />
        Kontakt: <a href="mailto:meteopacetluky@gmail.com" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline">meteopacetluky@gmail.com</a>
        <br />
        <InstallLink />
      </footer>
    </div>
  );
}
