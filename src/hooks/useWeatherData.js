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

// Hook pro minutová data jednoho dne (okno „Průběh jasu“).
// from/to = Date; `live` = dnešek, obnovuje se jako aktuální data. null from = nic nenačítat.
export function useDayHistory(from, to, live) {
  const url = from
    ? `/api/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
    : null;
  const { data, error, isLoading } = useSWR(url, fetcher, {
    refreshInterval: live ? POLL_INTERVAL : 0,
    revalidateOnFocus: live,
  });

  return {
    history: data,
    isLoading,
    isError: !!error || !!data?.error,
  };
}

// Hook pro kalendář jasna: dny měsíce s daty a minutami nad hranicí jasno.
// month = "YYYY-MM"; aktuální měsíc se obnovuje po 10 minutách. null = nic nenačítat.
export function useBrightnessMonth(month, isCurrent) {
  const { data, error, isLoading } = useSWR(
    month ? `/api/brightness-days?month=${month}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000,
      refreshInterval: isCurrent ? 600000 : 0,
    }
  );

  return {
    monthInfo: data?.error ? undefined : data,
    isLoading,
    isError: !!error || !!data?.error,
  };
}

// Hook pro minuty jasna za víc měsíců najednou (graf Historie měření u delších rozsahů).
// months = ["YYYY-MM", …]; vrací sloučené `days` ze všech měsíců.
const monthsFetcher = (key) =>
  Promise.all(
    key.split(',').map((m) => fetch(`/api/brightness-days?month=${m}`).then((r) => r.json()))
  ).then((list) => {
    if (list.some((x) => x.error)) throw new Error('brightness-days failed');
    return Object.assign({}, ...list.map((x) => x.days));
  });

export function useBrightnessDays(months) {
  const { data, error, isLoading } = useSWR(months?.length ? months.join(',') : null, monthsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600000,
  });
  return { days: data, isLoading, isError: !!error };
}

// Hook pro referenční venkovní teplotu z čidla kotle Viessmann (projekt p100)
export function useReferenceTemp() {
  const { data, error, isLoading } = useSWR('/api/reference-temp', fetcher, {
    refreshInterval: POLL_INTERVAL,
    revalidateOnFocus: true,
  });

  return {
    referenceTemp: data,
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

// Hook pro přesnost předpovědí
export function useForecastAccuracy() {
  const { data, error, isLoading } = useSWR('/api/forecast-accuracy', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600000,
    refreshInterval: 3600000,
  });

  return {
    accuracy: data,
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
