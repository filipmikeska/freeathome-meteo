'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatChartTime, formatTooltipTime } from '@/lib/utils';

const METRICS = [
  {
    key: 'temperature',
    label: 'Teplota',
    color: '#ef4444',
    unit: '°C',
    domain: ['auto', 'auto'],
  },
  {
    key: 'brightness',
    label: 'Jas',
    color: '#eab308',
    unit: ' lux',
    domain: [0, 'auto'],
  },
  {
    key: 'windSpeed',
    label: 'Vítr',
    color: '#6366f1',
    unit: ' m/s',
    domain: [0, 'auto'],
  },
];

// Mapování klíčů metrik na názvy min/max sloupců v agregacích
// Pokud agregace nemá dedikovaný min/max sloupec, padá se na raw hodnotu.
const EXTREME_FIELDS = {
  temperature: { min: 'tempMin', max: 'tempMax' },
  brightness: { max: 'brightnessMax' },
  windSpeed: { max: 'windMax' },
};

// Najde záznamy s minimální a maximální hodnotou dané metriky v datech
function findExtremes(data, key) {
  const fields = EXTREME_FIELDS[key] || {};
  let minRec = null;
  let maxRec = null;

  for (const d of data) {
    const raw = d[key];
    // Pro min/max použij agregovaný sloupec, pokud existuje; jinak raw hodnotu
    const minVal = (fields.min && d[fields.min] != null) ? d[fields.min] : raw;
    const maxVal = (fields.max && d[fields.max] != null) ? d[fields.max] : raw;

    if (minVal != null) {
      const n = Number(minVal);
      if (minRec == null || n < minRec.value) {
        minRec = { value: n, timestamp: d.timestamp };
      }
    }
    if (maxVal != null) {
      const n = Number(maxVal);
      if (maxRec == null || n > maxRec.value) {
        maxRec = { value: n, timestamp: d.timestamp };
      }
    }
  }
  return { min: minRec, max: maxRec };
}

function CustomTooltip({ active, payload, label, range }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
        {formatTooltipTime(label)}
      </p>
      {payload.map((entry) => {
        // Range (tempRange) je pole [min, max] — zobrazíme dohromady
        if (entry.dataKey === 'tempRange') {
          if (!Array.isArray(entry.value)) return null;
          return (
            <p key={entry.dataKey} className="text-sm text-red-400">
              Rozsah: <span className="font-semibold">
                {Number(entry.value[0]).toFixed(1)} – {Number(entry.value[1]).toFixed(1)}
              </span>°C
            </p>
          );
        }
        // Pro temperatureMin použij jednotku teploty
        const unitKey = entry.dataKey === 'temperatureMin' ? 'temperature' : entry.dataKey;
        return (
          <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{Number(entry.value).toFixed(1)}</span>
            {METRICS.find((m) => m.key === unitKey)?.unit || ''}
          </p>
        );
      })}
    </div>
  );
}

export default function WeatherChart({ data, range, isLoading }) {
  const [activeMetrics, setActiveMetrics] = useState(['temperature']);

  const toggleMetric = (key) => {
    setActiveMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // alespoň 1 aktivní
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Načítám data...</div>
        </div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-80 flex items-center justify-center text-gray-400">
          Žádná data pro zvolené období
        </div>
      </div>
    );
  }

  // Zjistíme, zda jsou data agregovaná (obsahují tempMax) — u 7d a 30d
  const isAggregated = data.some((d) => d.tempMax != null);

  // Pro agregace zobrazujeme MAX hodnoty (ne průměr), aby graf odpovídal
  // reálným extrémům. U raw 24h dat zůstávají jednotlivá měření.
  // U teploty navíc připravujeme `tempRange = [min, max]` pro pásmo pod křivkou.
  const chartData = data.map((item) => {
    if (!isAggregated) return { ...item };
    return {
      ...item,
      temperature: item.tempMax ?? item.temperature,
      temperatureMin: item.tempMin ?? item.temperature,
      tempRange:
        item.tempMin != null && item.tempMax != null
          ? [Number(item.tempMin), Number(item.tempMax)]
          : undefined,
      brightness: item.brightnessMax ?? item.brightness,
      windSpeed: item.windMax ?? item.windSpeed,
    };
  });

  const showTempRange = isAggregated && activeMetrics.includes('temperature');

  // Pokud je aktivní jen 1 metrika, zobrazíme area chart
  const showArea = activeMetrics.length === 1;
  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Přepínač metrik */}
      <div className="flex flex-wrap gap-2 mb-4">
        {METRICS.map((metric) => {
          const isActive = activeMetrics.includes(metric.key);
          return (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              style={isActive ? { backgroundColor: metric.color } : {}}
            >
              {metric.label}
            </button>
          );
        })}
      </div>

      {/* Graf */}
      <ResponsiveContainer width="100%" height={350}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" className="[.dark_&]:stroke-gray-700" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t) => formatChartTime(t, range)}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            stroke="#9ca3af"
          />
          {activeMetrics.map((key, index) => {
            const metric = METRICS.find((m) => m.key === key);
            return (
              <YAxis
                key={key}
                yAxisId={key}
                orientation={index === 0 ? 'left' : 'right'}
                domain={metric.domain}
                tick={{ fontSize: 12, fill: metric.color }}
                stroke={metric.color}
                tickFormatter={(v) => `${v}${metric.unit}`}
              />
            );
          })}
          <Tooltip content={<CustomTooltip range={range} />} />

          {/* Pásmo min–max u teploty v agregovaných datech */}
          {showTempRange && (
            <Area
              type="monotone"
              dataKey="tempRange"
              yAxisId="temperature"
              stroke="none"
              fill="#ef4444"
              fillOpacity={0.12}
              name="Rozsah teplot"
              activeDot={false}
              isAnimationActive={false}
            />
          )}

          {activeMetrics.map((key) => {
            const metric = METRICS.find((m) => m.key === key);
            if (showArea && !(showTempRange && key === 'temperature')) {
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  yAxisId={key}
                  stroke={metric.color}
                  fill={metric.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={metric.label}
                  dot={false}
                />
              );
            }
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                yAxisId={key}
                stroke={metric.color}
                strokeWidth={2}
                name={key === 'temperature' && showTempRange ? 'Max teplota' : metric.label}
                dot={false}
              />
            );
          })}

          {/* Linka minimální teploty u agregací */}
          {showTempRange && (
            <Line
              type="monotone"
              dataKey="temperatureMin"
              yAxisId="temperature"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 2"
              name="Min teplota"
              dot={false}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>

      {/* Min/Max pro každou aktivní metriku */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeMetrics.map((key) => {
          const metric = METRICS.find((m) => m.key === key);
          const { min, max } = findExtremes(data, key);
          if (!min || !max) return null;
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="text-xs font-medium" style={{ color: metric.color }}>
                {metric.label}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                  <span className="font-semibold">{max.value.toFixed(1)}{metric.unit}</span>
                  <span className="text-xs text-gray-400">· {formatTooltipTime(max.timestamp)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-semibold">{min.value.toFixed(1)}{metric.unit}</span>
                  <span className="text-xs text-gray-400">· {formatTooltipTime(min.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rain bar (if data has rain) */}
      {data.some((d) => d.rain != null) && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Srážky</h4>
          <div className="flex gap-px h-6 rounded overflow-hidden">
            {data.map((d, i) => (
              <div
                key={i}
                className={`flex-1 ${
                  Number(d.rain) === 1 || (d.rainMinutes && d.rainMinutes > 0)
                    ? 'bg-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
                title={`${formatChartTime(d.timestamp, range)}: ${
                  Number(d.rain) === 1 || (d.rainMinutes && d.rainMinutes > 0)
                    ? 'Déšť'
                    : 'Sucho'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatChartTime(data[0]?.timestamp, range)}</span>
            <span>{formatChartTime(data[data.length - 1]?.timestamp, range)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
