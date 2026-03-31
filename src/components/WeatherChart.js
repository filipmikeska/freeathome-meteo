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

function CustomTooltip({ active, payload, label, range }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-600 mb-2">
        {formatTooltipTime(label)}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{Number(entry.value).toFixed(1)}</span>
          {METRICS.find((m) => m.key === entry.dataKey)?.unit || ''}
        </p>
      ))}
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Načítám data...</div>
        </div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-80 flex items-center justify-center text-gray-400">
          Žádná data pro zvolené období
        </div>
      </div>
    );
  }

  // Připravíme data pro graf
  const chartData = data.map((item) => ({
    ...item,
    timestamp: item.timestamp,
  }));

  // Pokud je aktivní jen 1 metrika, zobrazíme area chart
  const showArea = activeMetrics.length === 1;
  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t) => formatChartTime(t, range)}
            tick={{ fontSize: 12 }}
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
                tick={{ fontSize: 12 }}
                stroke={metric.color}
                tickFormatter={(v) => `${v}${metric.unit}`}
              />
            );
          })}
          <Tooltip content={<CustomTooltip range={range} />} />
          {activeMetrics.map((key) => {
            const metric = METRICS.find((m) => m.key === key);
            if (showArea) {
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
                name={metric.label}
                dot={false}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>

      {/* Rain bar (if data has rain) */}
      {data.some((d) => d.rain != null) && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Srážky</h4>
          <div className="flex gap-px h-6 rounded overflow-hidden">
            {data.map((d, i) => (
              <div
                key={i}
                className={`flex-1 ${
                  Number(d.rain) === 1 || (d.rainMinutes && d.rainMinutes > 0)
                    ? 'bg-blue-400'
                    : 'bg-gray-100'
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
