'use client';

import { Sunrise, Sunset, Clock, Moon } from 'lucide-react';

function formatSunTime(isoString) {
  if (!isoString) return '--:--';
  return isoString.slice(11, 16);
}

function formatBrightnessShort(value) {
  if (value == null) return null;
  const num = Number(value);
  if (num >= 1000) return `${(num / 1000).toFixed(1)} klux`;
  return `${num.toFixed(0)} lux`;
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

// Calculate position on quadratic bezier: P0(10,70) Q(100,-10) P2(190,70)
function getSunPosition(progress) {
  const t = progress / 100;
  const x = (1-t)*(1-t)*10 + 2*(1-t)*t*100 + t*t*190;
  const y = (1-t)*(1-t)*70 + 2*(1-t)*t*(-10) + t*t*70;
  return { x, y };
}

export default function SunTimes({ forecast, brightness }) {
  const today = forecast?.daily?.[0];
  if (!today) return null;

  const { sunrise, sunset } = today;
  const daylight = getDaylightDuration(sunrise, sunset);
  const progress = getSunProgress(sunrise, sunset);
  const isDay = progress > 0 && progress < 100;
  const brightnessLabel = formatBrightnessShort(brightness);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">
          Délka dne: {daylight || '--'}
        </span>
      </div>

      {/* Sun arc visualization */}
      <div className="relative h-24 mb-3">
        <svg viewBox="0 0 200 95" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
          {/* Horizon line */}
          <line x1="10" y1="80" x2="190" y2="80" stroke="#e5e7eb" strokeWidth="1" />

          {/* Sun arc (dashed) */}
          <path
            d="M 10 80 Q 100 0 190 80"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity="0.4"
          />

          {/* Filled portion of arc */}
          {progress > 0 && progress < 100 && (
            <path
              d="M 10 80 Q 100 0 190 80"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray={`${progress * 2.5} 1000`}
            />
          )}

          {/* Sun position + brightness bubble */}
          {isDay && (() => {
            const t = progress / 100;
            const x = (1-t)*(1-t)*10 + 2*(1-t)*t*100 + t*t*190;
            const y = (1-t)*(1-t)*80 + 2*(1-t)*t*0 + t*t*80;

            // Bubble position above sun
            const bubbleY = y - 22;
            const bubbleWidth = brightnessLabel ? Math.max(brightnessLabel.length * 5.5 + 12, 44) : 44;

            return (
              <>
                {/* Brightness bubble */}
                {brightnessLabel && (
                  <>
                    {/* Bubble background */}
                    <rect
                      x={x - bubbleWidth/2}
                      y={bubbleY - 8}
                      width={bubbleWidth}
                      height={16}
                      rx="8"
                      fill="#fffbeb"
                      stroke="#fbbf24"
                      strokeWidth="0.8"
                    />
                    {/* Bubble text */}
                    <text
                      x={x}
                      y={bubbleY + 1.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="7"
                      fontWeight="600"
                      fill="#b45309"
                    >
                      ☀ {brightnessLabel}
                    </text>
                    {/* Bubble arrow */}
                    <polygon
                      points={`${x-3},${bubbleY+8} ${x+3},${bubbleY+8} ${x},${bubbleY+12}`}
                      fill="#fffbeb"
                      stroke="#fbbf24"
                      strokeWidth="0.8"
                      strokeLinejoin="round"
                    />
                    {/* Cover arrow top line */}
                    <line
                      x1={x-3}
                      y1={bubbleY+8}
                      x2={x+3}
                      y2={bubbleY+8}
                      stroke="#fffbeb"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* Sun glow */}
                <circle cx={x} cy={y} r="12" fill="#fbbf24" opacity="0.15" />
                {/* Sun circle */}
                <circle cx={x} cy={y} r="7" fill="#fbbf24" />
              </>
            );
          })()}

          {/* Night indicator (when sun is below horizon) */}
          {!isDay && (
            <>
              <text
                x="100"
                y="45"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="8"
                fill="#6366f1"
                opacity="0.7"
              >
                🌙 {brightnessLabel || '0 lux'}
              </text>
            </>
          )}
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
