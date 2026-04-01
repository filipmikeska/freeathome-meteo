'use client';

const PHASE_CZ = {
  'New Moon': 'Nov',
  'Waxing Crescent': 'Dorůstající srpek',
  'First Quarter': 'První čtvrť',
  'Waxing Gibbous': 'Dorůstající měsíc',
  'Full Moon': 'Úplněk',
  'Waning Gibbous': 'Couvající měsíc',
  'Last Quarter': 'Poslední čtvrť',
  'Waning Crescent': 'Ubývající srpek',
};

const PHASE_ORDER = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

function createMoonSVG(illumination, phaseName, size = 80) {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const frac = Math.max(0, Math.min(100, illumination)) / 100;
  const isWaning = /waning|last|couvaj|ubývaj|poslední/i.test(phaseName);
  const uid = `m${size}_${illumination}_${isWaning ? 'w' : 'x'}`;

  // New moon
  if (frac <= 0.01) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
        <circle cx={cx - 5} cy={cy - 6} r={r * 0.12} fill="#283548" opacity="0.5" />
        <circle cx={cx + 8} cy={cy + 5} r={r * 0.08} fill="#283548" opacity="0.4" />
      </svg>
    );
  }

  // Full moon
  if (frac >= 0.99) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id={`fg${uid}`} cx="40%" cy="38%">
            <stop offset="0%" stopColor="#fefce8" />
            <stop offset="100%" stopColor="#e2d9b8" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r + 1} fill="none" stroke="rgba(254,243,199,0.2)" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={r} fill={`url(#fg${uid})`} />
        <circle cx={cx + r * 0.15} cy={cy - r * 0.2} r={r * 0.1} fill="#d4c9a8" opacity="0.4" />
        <circle cx={cx - r * 0.1} cy={cy + r * 0.25} r={r * 0.13} fill="#d4c9a8" opacity="0.35" />
        <circle cx={cx + r * 0.3} cy={cy + r * 0.15} r={r * 0.07} fill="#d4c9a8" opacity="0.3" />
      </svg>
    );
  }

  // Partial moon — elliptical arc terminator
  const terminatorRx = r * Math.abs(2 * frac - 1);
  let litPath;

  if (!isWaning) {
    // WAXING — right side lit
    const rightArc = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
    if (frac <= 0.5) {
      litPath = `${rightArc} A ${terminatorRx} ${r} 0 0 0 ${cx} ${cy - r}`;
    } else {
      litPath = `${rightArc} A ${terminatorRx} ${r} 0 0 1 ${cx} ${cy - r}`;
    }
  } else {
    // WANING — left side lit
    const leftArc = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`;
    if (frac <= 0.5) {
      litPath = `${leftArc} A ${terminatorRx} ${r} 0 0 1 ${cx} ${cy - r}`;
    } else {
      litPath = `${leftArc} A ${terminatorRx} ${r} 0 0 0 ${cx} ${cy - r}`;
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <defs>
        <radialGradient id={`lit${uid}`} cx="40%" cy="38%">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#e2d9b8" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 1} fill="none" stroke={`rgba(254,243,199,${frac * 0.15})`} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
      <circle cx={cx - r * 0.15} cy={cy - r * 0.2} r={r * 0.1} fill="#283548" opacity="0.4" />
      <circle cx={cx + r * 0.2} cy={cy + r * 0.15} r={r * 0.08} fill="#283548" opacity="0.35" />
      <path d={litPath} fill={`url(#lit${uid})`} />
      <circle cx={cx + r * 0.15} cy={cy - r * 0.18} r={r * 0.08} fill="#d4c9a8" opacity="0.3" />
      <circle cx={cx - r * 0.08} cy={cy + r * 0.22} r={r * 0.1} fill="#d4c9a8" opacity="0.25" />
    </svg>
  );
}

function getPhaseProgress(phaseName) {
  const idx = PHASE_ORDER.indexOf(phaseName);
  if (idx < 0) return 50;
  return (idx / 8) * 100 + 6.25;
}

function daysUntil(dateStr, refDate) {
  if (!dateStr || !refDate) return null;
  const [day, monthDot] = dateStr.split('. ');
  const month = parseInt(monthDot);
  const d = parseInt(day);
  const ref = new Date(refDate);
  const target = new Date(ref.getFullYear(), month - 1, d);
  if (target < ref) target.setFullYear(target.getFullYear() + 1);
  const diff = Math.round((target - ref) / 86400000);
  return diff;
}

export default function MoonPhase({ moon, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (!moon || moon.error) return null;

  const { phase, illumination, moonrise, moonset, upcoming, date } = moon;
  const phaseCz = PHASE_CZ[phase] || phase;
  const progress = getPhaseProgress(phase);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-400" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Fáze Měsíce</span>
      </div>

      {/* Moon visual + info */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex-shrink-0">
          {createMoonSVG(illumination, phase, 72)}
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{phaseCz}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Osvětlení: {illumination} %</div>
          <div className="flex items-center gap-3 mt-2">
            {moonrise && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ▲ Východ <strong className="text-gray-700 dark:text-gray-300">{moonrise}</strong>
              </span>
            )}
            {moonset && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ▼ Západ <strong className="text-gray-700 dark:text-gray-300">{moonset}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(90deg, #1e293b 0%, #fef3c7 50%, #1e293b 100%)' }}>
        <div
          className="absolute top-1/2 w-3 h-3 bg-amber-400 border-2 border-white dark:border-gray-800 rounded-full shadow-md"
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {[
          { n: 'Nov', i: 0, p: 'New Moon' },
          { n: '1. čtvrť', i: 50, p: 'First Quarter' },
          { n: 'Úplněk', i: 100, p: 'Full Moon' },
          { n: 'Posl. čtvrť', i: 50, p: 'Last Quarter' },
        ].map((x) => (
          <div key={x.p} className="flex flex-col items-center">
            {createMoonSVG(x.i, x.p, 18)}
            <span className="text-[10px] text-gray-400 mt-0.5">{x.n}</span>
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      {upcoming && upcoming.length > 0 && (
        <div className="flex justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {upcoming.slice(0, 3).map((p, i) => {
            const days = daysUntil(p.date, date);
            return (
              <div key={i} className="text-center">
                <div className="text-xs text-gray-400">{PHASE_CZ[p.phase] || p.phase}</div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{p.date}</div>
                {days != null && (
                  <div className="text-[10px] text-gray-400">
                    za {days} {days < 5 ? 'dny' : 'dní'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
