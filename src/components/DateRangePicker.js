'use client';

const RANGES = [
  { value: '24h', label: '24 hodin' },
  { value: '7d', label: '7 dní' },
  { value: '30d', label: '30 dní' },
];

export default function DateRangePicker({ range, onRangeChange, customFrom, customTo, onCustomChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg overflow-hidden border border-gray-300">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              range === r.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => onRangeChange('custom')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            range === 'custom'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Vlastní
        </button>
      </div>

      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => onCustomChange('from', e.target.value)}
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <span className="text-gray-500">—</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => onCustomChange('to', e.target.value)}
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
