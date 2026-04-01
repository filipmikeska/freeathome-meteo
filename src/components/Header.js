'use client';

import { useState, useEffect, useRef } from 'react';
import { CloudRain, Info, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

function InfoPopup({ onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={ref}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-slide-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            O projektu
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Meteostanice</h3>
            <p>
              Data pocházejí z meteostanice <strong>ABB free@home WS-1</strong> umístěné
              v Pacetlukách u Kroměříže (49.38°N, 17.57°E). Stanice měří teplotu,
              rychlost větru, intenzitu osvětlení (jas) a detekci srážek.
              Nachází se na rodinném domě v zástavbě, proto mohou být
              naměřené hodnoty částečně zkresleny okolní zástavbou.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Sběr dat</h3>
            <p>
              Měření probíhá každých <strong>60 sekund</strong>. Data sbírá{' '}
              <strong>Raspberry Pi Zero 2W</strong>, které komunikuje přímo
              se systémovým přístupovým bodem (SysAP) přes lokální síť.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Ukládání dat</h3>
            <p>
              Naměřené hodnoty se ukládají do databáze <strong>Turso</strong> (SQLite v cloudu).
              Z hrubých dat se automaticky počítají hodinové a denní agregace
              (průměr, minimum, maximum). Historická data se uchovávají po dobu 1 roku.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Předpověď počasí</h3>
            <p>
              Předpověď na 7 dní pochází ze dvou nezávislých zdrojů &mdash;{' '}
              <strong>Open-Meteo</strong> (model ECMWF) a <strong>Yr.no</strong> (MET Norway).
              Údaje o slunci a měsíci poskytuje U.S. Naval Observatory.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Technologie</h3>
            <p>
              Web běží na platformě <strong>Vercel</strong> a je postaven
              na <strong>Next.js</strong> (React) s knihovnou Tailwind CSS. Grafy
              vykresluje Recharts. Data se na stránce aktualizují každých 60 sekund.
              Web funguje i jako PWA aplikace pro mobilní zařízení i desktop.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Kontakt</h3>
            <p>
              <a
                href="mailto:meteopacetluky@gmail.com"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                meteopacetluky@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CloudRain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Meteostanice
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ABB free@home &middot; Pacetluky
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 dark:text-gray-500 hidden sm:inline mr-1">
                49.3794°N, 17.5658°E
              </span>
              <button
                onClick={() => setShowInfo(true)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                aria-label="O projektu"
              >
                <Info className="h-5 w-5" />
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {showInfo && <InfoPopup onClose={() => setShowInfo(false)} />}
    </>
  );
}
