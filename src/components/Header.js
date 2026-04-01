'use client';

import { CloudRain } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 dark:text-gray-500 hidden sm:inline">
              49.3794°N, 17.5658°E
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
