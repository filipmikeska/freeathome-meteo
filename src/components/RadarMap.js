'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import L from 'leaflet';

const PACETLUKY = [49.3794, 17.5658];
const DEFAULT_ZOOM = 8;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minut
const ANIMATION_SPEED = 500; // ms mezi snímky

// ČHMÚ radar composite geo-bounds (Web Mercator)
const RADAR_BOUNDS = [
  [48.047, 11.267], // SW
  [51.458, 19.624], // NE
];

// Legenda — barevná škála srážek (přibližně ČHMÚ stupnice)
const LEGEND_ITEMS = [
  { color: '#9bf', label: '0.1' },
  { color: '#5af', label: '1' },
  { color: '#19f', label: '2' },
  { color: '#3f3', label: '4' },
  { color: '#2d2', label: '8' },
  { color: '#ff0', label: '12' },
  { color: '#fc0', label: '16' },
  { color: '#fa0', label: '24' },
  { color: '#f60', label: '32' },
  { color: '#f00', label: '40' },
  { color: '#d00', label: '48' },
  { color: '#a00', label: '55' },
  { color: '#f0f', label: '60' },
];

export default function RadarMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const radarLayerRef = useRef(null);
  const markerRef = useRef(null);

  const [frames, setFrames] = useState([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opacity, setOpacity] = useState(0.7);

  const intervalRef = useRef(null);

  // Fetch radar data from our API
  const fetchRadarData = useCallback(async () => {
    try {
      const res = await fetch('/api/radar?hours=3');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBaseUrl(data.base);
      setFrames(data.frames);
      setCurrentFrame(data.frames.length - 1);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError('Nepodařilo se načíst radarová data z ČHMÚ');
      setIsLoading(false);
    }
  }, []);

  // Init map
  useEffect(() => {
    if (mapInstance.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current, {
      center: PACETLUKY,
      zoom: DEFAULT_ZOOM,
      maxZoom: 13,
      minZoom: 6,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Marker
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    markerRef.current = L.marker(PACETLUKY, { icon })
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
    if (!mapInstance.current || !baseUrl || frames.length === 0) return;

    const frame = frames[currentFrame];
    if (!frame) return;

    const imageUrl = `${baseUrl}${frame.filename}`;
    const bounds = L.latLngBounds(RADAR_BOUNDS[0], RADAR_BOUNDS[1]);

    if (radarLayerRef.current) {
      radarLayerRef.current.setUrl(imageUrl);
    } else {
      radarLayerRef.current = L.imageOverlay(imageUrl, bounds, {
        opacity,
        zIndex: 10,
        interactive: false,
      }).addTo(mapInstance.current);
    }
  }, [currentFrame, frames, baseUrl, opacity]);

  // Update opacity
  useEffect(() => {
    if (radarLayerRef.current) {
      radarLayerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

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

  const formatTimeShort = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
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

  // Vyber pár časů pro timeline (každých 30 minut)
  const timelineTicks = frames.filter((_, i) => i % 6 === 0 || i === frames.length - 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Timeline nahoře */}
      {!isLoading && frames.length > 0 && (
        <div className="px-4 pt-3 pb-1 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handlePlayPause}
              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
              aria-label={isPlaying ? 'Pauza' : 'Přehrát'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={stepBack}
              disabled={currentFrame === 0}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors flex-shrink-0"
              aria-label="Předchozí"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={stepForward}
              disabled={currentFrame >= frames.length - 1}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors flex-shrink-0"
              aria-label="Další"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            {/* Timeline slider s časy */}
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={currentFrame}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrame(Number(e.target.value));
                }}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              {/* Časové značky pod sliderem */}
              <div className="flex justify-between mt-0.5 px-0.5">
                {timelineTicks.map((f, i) => (
                  <span key={f.timestamp} className="text-[10px] text-gray-400 dark:text-gray-500">
                    {formatTimeShort(f.timestamp)}
                  </span>
                ))}
              </div>
            </div>

            {/* Aktuální čas */}
            <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0 min-w-[100px] text-right">
              {formatTime(frames[currentFrame]?.timestamp)}
            </span>
          </div>
        </div>
      )}

      {/* Mapa */}
      <div ref={mapRef} className="w-full" style={{ height: '500px' }} />

      {/* Legenda + průhlednost */}
      {!isLoading && frames.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
          {/* Legenda srážek */}
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-gray-400 mr-1">mm/h</span>
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex flex-col items-center">
                <div
                  className="w-4 h-3 sm:w-5 sm:h-4"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Průhlednost */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Průhlednost</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="px-4 py-6 text-center" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-pulse text-gray-400">Načítám radarová data z ČHMÚ...</div>
        </div>
      )}
    </div>
  );
}
