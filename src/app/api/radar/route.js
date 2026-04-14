import { NextResponse } from 'next/server';

const CHMI_BASE = 'https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/';
const FILENAME_RE = /pacz2gmaps3\.z_cappi020\.(\d{8})\.(\d{4})\.0\.png/g;

export const revalidate = 60; // cache 1 minuta

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hours = Math.min(parseInt(searchParams.get('hours') || '3', 10), 24);

  try {
    const res = await fetch(CHMI_BASE, { next: { revalidate: 60 } });
    const html = await res.text();

    const frames = [];
    let match;
    while ((match = FILENAME_RE.exec(html)) !== null) {
      const [filename, date, time] = match;
      // ČHMÚ časy jsou v UTC
      const year = date.slice(0, 4);
      const month = date.slice(4, 6);
      const day = date.slice(6, 8);
      const hour = time.slice(0, 2);
      const min = time.slice(2, 4);
      const timestamp = Date.UTC(+year, +month - 1, +day, +hour, +min) / 1000;
      frames.push({ filename, timestamp });
    }

    // Filtrovat na posledních N hodin
    const now = Date.now() / 1000;
    const cutoff = now - hours * 3600;
    const filtered = frames
      .filter((f) => f.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      base: CHMI_BASE,
      frames: filtered,
      bounds: {
        southWest: [48.047, 11.267],
        northEast: [51.458, 19.624],
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Nelze načíst data z ČHMÚ' }, { status: 502 });
  }
}
