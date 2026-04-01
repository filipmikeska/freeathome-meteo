'use client';

import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

const POLL_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL || '60000',
  10
);

// Hook pro aktuální data s automatickým pollingem
export function useCurrentWeather() {
  const { data, error, isLoading } = useSWR('/api/current', fetcher, {
    refreshInterval: POLL_INTERVAL,
    revalidateOnFocus: true,
  });

  return {
    current: data,
    isLoading,
    isError: !!error,
  };
}

// Hook pro historická data
export function useWeatherHistory(range = '24h', from = null, to = null) {
  let url = `/api/history?range=${range}`;
  if (from && to) {
    url = `/api/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  return {
    history: data,
    isLoading,
    isError: !!error,
  };
}

// Hook pro data o měsíci (aktualizace každou hodinu)
export function useMoonData() {
  const { data, error, isLoading } = useSWR('/api/moon', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600000,
    refreshInterval: 3600000,
  });

  return {
    moon: data,
    isLoading,
    isError: !!error,
  };
}

// Hook pro dnešní statistiky (min/max s časy)
export function useTodayStats() {
  const { data, error, isLoading } = useSWR('/api/stats', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 60000,
    refreshInterval: POLL_INTERVAL,
  });

  return {
    stats: data,
    isLoading,
    isError: !!error,
  };
}

// Hook pro předpověď počasí (cache 1h na serveru, revalidace každou hodinu na klientu)
export function useForecast() {
  const { data, error, isLoading } = useSWR('/api/forecast', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600000, // 1 hodina
    refreshInterval: 3600000,
  });

  return {
    forecast: data,
    isLoading,
    isError: !!error,
  };
}

// Hook pro předpověď Yr.no (MET Norway)
export function useForecastYr() {
  const { data, error, isLoading } = useSWR('/api/forecast-yr', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600000,
    refreshInterval: 3600000,
  });

  return {
    forecastYr: data,
    isLoading,
    isError: !!error,
  };
}
