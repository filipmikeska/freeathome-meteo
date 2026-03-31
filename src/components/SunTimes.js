'use client';

import { Sunrise, Sunset, Clock } from 'lucide-react';

function formatSunTime(isoString) {
  if (!isoString) return '--:--';
  // "2026-03-31T06:23" → "06:23"
  return isoString.slice(11, 16);
}

function getDaylightDuration(sunrise, sunset) {
  if (!sunrise || !sunset) return null;
  const rise = new Date(sunrise);
  const set = new Date(sunset);
  const diffMs = set - rise;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function getSunProgress(sunrise, sunset) {
  if (!sunrise || !sunset) return 0;
  const now = new Date();
  const rise = new Date(sunrise);
  const set = new Date(sunset);
  if (now < rise) return 0;
  if (now > set) return 100;
  return ((now - rise) / (set - rise)) * 100;
}

export default function SunTimes({ forecast }) {
  // Vezmi dnešní den z předpovědi
  const today = forecast?.daily?.[0];
  if (!today) return null;

  const { sunrise, sunset } = today;
  const daylight = getDaylightDuration(sunrise, sunset);
  const progress = getSunProgress(sunrise, sunset);
  const isDay = progress > 0 && progress < 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">
          Délka dne: {daylight || '--'}
        </span>
      </div>

      {/* Sun arc visualization */}
      <div className="relative h-16 mb-3">
        {/* Arc path */}
        <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
          {/* Horizon line */}
          <line x1="10" y1="70" x2="190" y2="70" stroke="#e5e7eb" strokeWidth="1" />

          {/* Sun arc */}
          <path
            d="M 10 70 Q 100 -10 190 70"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity="0.4"
          />

          {/* Filled portion of arc */}
          {progress > 0 && progress < 100 && (
            <path
              d="M 10 70 Q 100 -10 190 70"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray={`${progress * 2.5} 1000`}
            />
          )}

          {/* Sun position */}
          {isDay && (() => {
            // Calculate position on quadratic bezier: P0(10,70) Q(100,-10) P2(190,70)
            const t = progress / 100;
            const x = (1-t)*(1-t)*10 + 2*(1-t)*t*100 + t*t*190;
            const y = (1-t)*(1-t)*70 + 2*(1-t)*t*(-10) + t*t*70;
            return (
              <>
                <circle cx={x} cy={y} r="8" fill="#fbbf24" />
                <circle cx={x} cy={y} r="12" fill="#fbbf24" opacity="0.2" />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Sunrise & Sunset times */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="h-5 w-5 text-orange-400" />
          <div>
            <div className="text-xs text-gray-500">Východ slunce</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSunTime(sunrise)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-gray-500">Západ slunce</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSunTime(sunset)}
            </div>
          </div>
          <Sunset className="h-5 w-5 text-indigo-400" />
        </div>
      </div>
    </div>
  );
}
