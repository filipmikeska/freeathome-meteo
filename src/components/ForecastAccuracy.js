'use client';

import { BarChart3, Thermometer, Wind, Droplets, Calendar } from 'lucide-react';
import { useForecastAccuracy } from '@/hooks/useWeatherData';

function StatCard({ label, value, unit, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {value != null ? `${value} ${unit}` : 'Zatím nedostatek dat'}
        </div>
      </div>
    </div>
  );
}

function SourceBlock({ name, data }) {
  if (!data) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {name}
        {data.days > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            ({data.days} {data.days === 1 ? 'den' : data.days < 5 ? 'dny' : 'dní'})
          </span>
        )}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatCard
          label="Odchylka teploty"
          value={data.tempMAE}
          unit="°C"
          icon={Thermometer}
          color="bg-red-100 dark:bg-red-900/30 text-red-500"
        />
        <StatCard
          label="Odchylka větru"
          value={data.windMAE}
          unit="m/s"
          icon={Wind}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-500"
        />
        <StatCard
          label="Úspěšnost srážek"
          value={data.rainAccuracy}
          unit="%"
          icon={Droplets}
          color="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-500"
        />
      </div>
    </div>
  );
}

export default function ForecastAccuracy() {
  const { accuracy, isLoading, isError } = useForecastAccuracy();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !accuracy?.summary) {
    return null; // Tiše skrýt pokud není dostupné
  }

  const { summary } = accuracy;
  const hasData = summary['open-meteo']?.days > 0 || summary.yr?.days > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Přesnost předpovědí
          </h3>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          posledních 30 dní
        </span>
      </div>

      {!hasData ? (
        <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Data se začnou zobrazovat po prvních dnech sběru předpovědí.</p>
          <p className="text-xs mt-1">Předpovědi se ukládají automaticky při každé návštěvě webu.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <SourceBlock name="Open-Meteo (ECMWF)" data={summary['open-meteo']} />
          <SourceBlock name="Yr.no (MET Norway)" data={summary.yr} />

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Odchylka = průměrná absolutní chyba (MAE). Nižší je lepší.
            Srážky: shoda předpovědi (déšť ano/ne) s měřením.
          </p>
        </div>
      )}
    </div>
  );
}
