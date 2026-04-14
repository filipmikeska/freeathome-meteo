'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import L from 'leaflet';

const PACETLUKY = [49.3794, 17.5658];
const DEFAULT_ZOOM = 7;
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minut
const ANIMATION_SPEED = 800; // ms mezi snímky

export default function RadarMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const radarLayerRef = useRef(null);
  const markerRef = useRef(null);

  const [frames, setFrames] = useState([]);
  const [host, setHost] = useState('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);

  // Fetch radar data
  const fetchRadarData = useCallback(async () => {
    try {
      const res = await fetch(RAINVIEWER_API);
      const data = await res.json();
      setHost(data.host);
      const allFrames = [
        ...data.radar.past.map((f) => ({ ...f, type: 'past' })),
        ...data.radar.nowcast.map((f) => ({ ...f, type: 'nowcast' })),
      ];
      setFrames(allFrames);
      setCurrentFrame(data.radar.past.length - 1); // poslední aktuální snímek
      setIsLoading(false);
      setError(null);
    } catch {
      setError('Nepodařilo se načíst radarová data');
      setIsLoading(false);
    }
  }, []);

  // Init map
  useEffect(() => {
    if (mapInstance.current) return;

    // Fix Leaflet default icon paths (webpack issue)
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current, {
      center: PACETLUKY,
      zoom: DEFAULT_ZOOM,
      maxZoom: 7,
      minZoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 7,
    }).addTo(map);

    markerRef.current = L.marker(PACETLUKY)
      .addTo(map)
      .bindPopup('Meteostanice Pacetluky');

    mapInstance.current = map;

    fetchRadarData();
    const refreshTimer = setInterval(fetchRadarData, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshTimer);
      map.remove();
      mapInstance.current = null;
    };
  }, [fetchRadarData]);

  // Update radar overlay when frame changes
  useEffect(() => {
    if (!mapInstance.current || !host || frames.length === 0) return;

    const frame = frames[currentFrame];
    if (!frame) return;

    if (radarLayerRef.current) {
      mapInstance.current.removeLayer(radarLayerRef.current);
    }

    radarLayerRef.current = L.tileLayer(
      `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
      {
        opacity: 0.65,
        zIndex: 10,
      }
    ).addTo(mapInstance.current);
  }, [currentFrame, frames, host]);

  // Animation
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = prev + 1;
          if (next >= frames.length) {
            setIsPlaying(false);
            return frames.length - 1;
          }
          return next;
        });
      }, ANIMATION_SPEED);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, frames.length]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePlayPause = () => {
    if (!isPlaying && currentFrame >= frames.length - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const stepBack = () => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.max(0, prev - 1));
  };

  const stepForward = () => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.min(frames.length - 1, prev + 1));
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Mapa */}
      <div
        ref={mapRef}
        className="w-full"
        style={{ height: '450px' }}
      />

      {/* Ovládání */}
      {!isLoading && frames.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          {/* Čas */}
          <div className="text-center mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatTime(frames[currentFrame]?.time)}
            </span>
            {frames[currentFrame]?.type === 'nowcast' && (
              <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                předpověď
              </span>
            )}
          </div>

          {/* Tlačítka + slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={stepBack}
              disabled={currentFrame === 0}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              aria-label="Předchozí snímek"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label={isPlaying ? 'Pauza' : 'Přehrát'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={stepForward}
              disabled={currentFrame >= frames.length - 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              aria-label="Další snímek"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={currentFrame}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentFrame(Number(e.target.value));
              }}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="px-4 py-6 text-center">
          <div className="animate-pulse text-gray-400">Načítám radarová data...</div>
        </div>
      )}
    </div>
  );
}
