'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { Sun, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDayHistory } from '@/hooks/useWeatherData';
import {
  thresholdAt,
  pragueDay,
  daylightWindow,
  formatDayLabel,
  parseDbTimestamp,
  summarizeDay,
  formatDuration,
  formatClock,
} from '@/lib/brightness';

// Jak daleko do minulosti jdou minutová data (retence measurements)
const MAX_DAYS_BACK = 365;
const AMBER = '#f59e0b';
const YELLOW = '#eab308';

const klx = (lux) =>
  `${(lux / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} klx`;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { t, lux, thr } = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="text-xs text-gray-500 dark:text-gray-400">{formatClock(t)}</div>
      <div className="font-semibold text-gray-900 dark:text-white">{klx(lux)}</div>
      {thr != null && (
        <div className="text-xs text-gray-500 dark:text-gray-400">hranice jasno {klx(thr)}</div>
      )}
      {thr != null && lux >= thr && <div className="text-xs font-medium text-amber-500">nad hranicí jasno</div>}
    </div>
  );
}

export default function BrightnessDayModal({ onClose }) {
  const [offset, setOffset] = useState(0);
  const day = useMemo(() => pragueDay(offset), [offset]);
  const axis = useMemo(() => daylightWindow(day), [day]);
  const isToday = offset === 0;
  const { history, isLoading, isError } = useDayHistory(day.start, day.end, isToday);

  // Zavření klávesou Esc + zamčení scrollu stránky pod oknem
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setOffset((o) => Math.max(o - 1, -MAX_DAYS_BACK));
      if (e.key === 'ArrowRight') setOffset((o) => Math.min(o + 1, 0));
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const points = useMemo(
    () =>
      (history?.data || [])
        .filter((d) => d.brightness != null)
        .map((d) => ({ t: parseDbTimestamp(d.timestamp), lux: Number(d.brightness) }))
        .sort((a, b) => a.t - b.t),
    [history]
  );
  const summary = useMemo(() => summarizeDay(points), [points]);

  const chartData = useMemo(
    () =>
      points
        .filter((p) => p.t >= axis.from && p.t <= axis.to)
        .map((p) => {
          // Hranice se mění s výškou Slunce; null = Slunce příliš nízko, čára se nekreslí
          const thr = thresholdAt(p.t);
          // `above` = pásmo mezi hranicí a křivkou, zvýrazní čas nad hranicí
          return { ...p, thr, above: thr == null ? null : [thr, Math.max(p.lux, thr)] };
        }),
    [points, axis]
  );
  const maxThr = chartData.reduce((m, p) => Math.max(m, p.thr || 0), 0);

  // Osa Y: aspoň do 60 klx; jinak po 20 klx nad maximum jasu i hranice
  const yMax = Math.max(60000, Math.ceil(Math.max(summary.max?.lux || 0, maxThr) / 20000) * 20000);
  const yTicks = [];
  for (let v = 0; v <= yMax; v += 20000) yTicks.push(v);
  const xTicks = [];
  for (let t = axis.from; t <= axis.to; t += 2 * 3600000) xTicks.push(t);
  const bandHeight = yMax * 0.025;

  const hasData = chartData.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex sm:items-center sm:justify-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brightness-day-title"
        className="w-full h-full sm:h-auto sm:max-w-3xl bg-white dark:bg-gray-800 sm:rounded-2xl sm:border border-gray-200 dark:border-gray-700 shadow-2xl p-4 sm:p-5 overflow-y-auto animate-slide-up"
      >
        {/* Hlavička: název, přepínání dnů, zavřít */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="brightness-day-title" className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <Sun className="h-5 w-5 text-yellow-500" />
            Průběh jasu
          </h2>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setOffset((o) => o - 1)}
              disabled={offset <= -MAX_DAYS_BACK}
              aria-label="Předchozí den"
              className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-medium text-gray-900 dark:text-white">
              {formatDayLabel(day.start, offset)}
            </span>
            <button
              onClick={() => setOffset((o) => o + 1)}
              disabled={isToday}
              aria-label="Další den"
              className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Zavřít"
              className="ml-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Graf */}
        <div className="h-72">
          {isLoading && !history ? (
            <div className="h-full rounded-lg bg-gray-100 dark:bg-gray-700/50 animate-pulse" />
          ) : isError || !hasData ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              {isError ? 'Data se nepodařilo načíst.' : 'Pro tento den nejsou k dispozici data.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="brightnessFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={YELLOW} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={YELLOW} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" className="[.dark_&]:stroke-gray-700" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[axis.from, axis.to]}
                  ticks={xTicks}
                  tickFormatter={formatClock}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  stroke="#9ca3af"
                />
                <YAxis
                  domain={[0, yMax]}
                  ticks={yTicks}
                  tickFormatter={(v) => `${v / 1000}k`}
                  tick={{ fontSize: 12, fill: YELLOW }}
                  stroke={YELLOW}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="lux"
                  stroke={YELLOW}
                  strokeWidth={1.5}
                  fill="url(#brightnessFill)"
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Čas nad hranicí jasno */}
                <Area
                  type="monotone"
                  dataKey="above"
                  stroke="none"
                  fill={AMBER}
                  fillOpacity={0.45}
                  activeDot={false}
                  isAnimationActive={false}
                />
                {/* Hranice jasno: 70 % jasu jasné oblohy, mění se během dne */}
                <Line
                  type="monotone"
                  dataKey="thr"
                  stroke={AMBER}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                {/* Proužky pod osou: úseky nad hranicí */}
                {summary.intervals.map((iv) => (
                  <ReferenceArea
                    key={iv.start}
                    x1={Math.max(iv.start, axis.from)}
                    x2={Math.min(iv.end, axis.to)}
                    y1={0}
                    y2={bandHeight}
                    fill={AMBER}
                    fillOpacity={1}
                    stroke="none"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legenda k čárkované křivce */}
        {hasData && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke={AMBER} strokeWidth="1.5" strokeDasharray="6 4" />
            </svg>
            hranice jasno: 70 % jasu za jasné oblohy při dané výšce Slunce
          </div>
        )}

        {/* Souhrn */}
        {hasData && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Nad hranicí jasno{isToday ? ' (zatím)' : ''}
              </div>
              <div className="text-2xl font-bold text-amber-500">{formatDuration(summary.totalMinutes)}</div>
            </div>
            {summary.listedIntervals.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 pb-1">
                {summary.listedIntervals.map((iv) => `${formatClock(iv.start)}–${formatClock(iv.end)}`).join(' · ')}
              </div>
            )}
            {summary.max && (
              <div className="sm:ml-auto text-xs text-gray-500 dark:text-gray-400 pb-1">
                Max <span className="font-semibold text-gray-900 dark:text-white">{klx(summary.max.lux)}</span> v{' '}
                {formatClock(summary.max.t)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
