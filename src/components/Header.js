'use client';

import { CloudRain } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CloudRain className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Meteostanice
              </h1>
              <p className="text-sm text-gray-500">
                ABB free@home &middot; Pacetluky
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            49.3333°N, 17.5783°E
          </div>
        </div>
      </div>
    </header>
  );
}
