'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBrightnessMonth } from '@/hooks/useWeatherData';

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const pad = (n) => String(n).padStart(2, '0');

function shiftMonth(month, n) {
  const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

const monthTitle = (month) =>
  new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1))
  );

const hours = (minutes) =>
  (minutes / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// Měsíční kalendář pro výběr dne v okně „Průběh jasu“.
// Vybrat jdou jen dny s daty; číslo pod dnem = hodiny nad hranicí jasno, podbarvení podle nich.
export default function BrightnessCalendar({ selectedKey, todayKey, firstDay, onSelect, onClose, anchorRef }) {
  const [month, setMonth] = useState(selectedKey.slice(0, 7));
  const todayMonth = todayKey.slice(0, 7);
  const { monthInfo, isLoading, isError } = useBrightnessMonth(month, month === todayMonth);
  const ref = useRef(null);

  // Klik mimo kalendář (a mimo tlačítko s datem, které ho přepíná) ho zavře
  useEffect(() => {
    const handler = (e) => {
      if (ref.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose, anchorRef]);

  const firstMonth = (monthInfo?.firstDay || firstDay)?.slice(0, 7);
  const canPrev = !firstMonth || month > firstMonth;
  const canNext = month < todayMonth;

  const year = +month.slice(0, 4);
  const mon = +month.slice(5, 7);
  const lead = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7; // pondělí = 0
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const days = monthInfo?.days || {};

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${month}-${pad(d)}`;
    const info = days[key];
    const enabled = !!info && key <= todayKey;
    const selected = key === selectedKey;
    const isToday = key === todayKey;
    const minutes = info?.clearMinutes || 0;
    // Podbarvení podle hodin jasna: 10 h a víc = plná intenzita
    const heat = enabled && !selected && minutes > 0 ? 0.1 + 0.45 * Math.min(minutes / 600, 1) : 0;

    cells.push(
      <button
        key={key}
        type="button"
        disabled={!enabled}
        onClick={() => onSelect(key)}
        aria-label={`${d}. ${mon}.${enabled ? `, jasno ${hours(minutes)} h` : ', bez dat'}`}
        aria-pressed={selected}
        style={heat ? { backgroundColor: `rgba(245, 158, 11, ${heat})` } : undefined}
        className={`h-11 rounded-md flex flex-col items-center justify-center leading-none transition-colors ${
          selected
            ? 'bg-amber-500 text-white'
            : enabled
              ? 'text-gray-900 dark:text-white hover:ring-2 hover:ring-amber-400'
              : 'text-gray-300 dark:text-gray-600 cursor-default'
        } ${isToday && !selected ? 'ring-1 ring-gray-400 dark:ring-gray-500' : ''}`}
      >
        <span className="text-sm font-medium">{d}</span>
        {enabled && (
          <span
            className={`mt-0.5 text-[10px] tabular-nums ${
              selected ? 'text-white/90' : minutes > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'
            }`}
          >
            {minutes > 0 ? hours(minutes) : '–'}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-20 w-[19.5rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-3 animate-slide-up"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={!canPrev}
          aria-label="Předchozí měsíc"
          className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{monthTitle(month)}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={!canNext}
          aria-label="Další měsíc"
          className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-medium text-gray-400 pb-1">
            {w}
          </div>
        ))}
        {cells}
      </div>

      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {isError
          ? 'Kalendář se nepodařilo načíst.'
          : isLoading && !monthInfo
            ? 'Načítám dny…'
            : 'Číslo pod dnem = hodiny nad hranicí jasno'}
      </div>
    </div>
  );
}
