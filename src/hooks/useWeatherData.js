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
