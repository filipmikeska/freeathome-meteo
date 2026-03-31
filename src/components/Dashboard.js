'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, CalendarDays } from 'lucide-react';
import CurrentWeather from './CurrentWeather';
import WeatherChart from './WeatherChart';
import DateRangePicker from './DateRangePicker';
import ForecastCard from './ForecastCard';
import { useCurrentWeather, useWeatherHistory, useForecast } from '@/hooks/useWeatherData';
import { formatTooltipTime } from '@/lib/utils';

export default function Dashboard() {
  const [range, setRange] = useState('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { current, isLoading: currentLoading } = useCurrentWeather();
  const { forecast, isLoading: forecastLoading } = useForecast();

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Aktuální data */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Aktuální počasí
          </h2>
          {current?.timestamp && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>
                {formatTooltipTime(current.timestamp)}
              </span>
            </div>
          )}
        </div>
        <CurrentWeather data={current} isLoading={currentLoading} />
      </section>

      {/* Předpověď */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Předpověď na 7 dní
            </h2>
          </div>
          <span className="text-sm text-gray-400">
            Zdroj: Open-Meteo (ECMWF)
          </span>
        </div>
        <ForecastCard forecast={forecast} isLoading={forecastLoading} />
      </section>

      {/* Grafy */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Historie
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

      {/* Informace */}
      <footer className="text-center text-sm text-gray-400 pb-4">
        Data z meteostanice ABB free@home WS-1 &middot;
        Předpověď: Open-Meteo.com &middot;
        Aktualizace každých{' '}
        {Math.round((parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL || '60000') / 1000))} s
      </footer>
    </div>
  );
}
