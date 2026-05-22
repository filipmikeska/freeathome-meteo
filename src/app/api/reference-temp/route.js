import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Referenční venkovní teplota z čidla kotle Viessmann Vitodens 200-W.
// Data sbírá RPi poller projektu p100 do samostatné Turso databáze p100-home,
// tabulka heating_snapshots, sloupec outside_temp (#2 dle docs/kotel-parametry.pdf).

async function execute(sql, args = []) {
  let url = process.env.P100_DATABASE_URL;
  const authToken = process.env.P100_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error('P100_DATABASE_URL / P100_AUTH_TOKEN nejsou nastaveny');
  }
  if (url.startsWith('libsql://')) url = url.replace('libsql://', 'https://');

  const stmtArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') {
      return Number.isInteger(a)
        ? { type: 'integer', value: String(a) }
        : { type: 'float', value: a };
    }
    return { type: 'text', value: String(a) };
  });

  const response = await fetch(`${url.trim()}/v2/pipeline`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: stmtArgs } },
        { type: 'close' },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Turso API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.results?.[0]?.response?.result;
  if (!result) return [];

  const columns = result.cols?.map((c) => c.name) || [];
  return (result.rows || []).map((row) => {
    const obj = {};
    row.forEach((cell, i) => {
      const col = columns[i];
      if (cell.type === 'integer') obj[col] = parseInt(cell.value);
      else if (cell.type === 'float') obj[col] = parseFloat(cell.value);
      else if (cell.type === 'null') obj[col] = null;
      else obj[col] = cell.value;
    });
    return obj;
  });
}

export async function GET() {
  try {
    const rows = await execute(
      `SELECT outside_temp, ts FROM heating_snapshots
       WHERE outside_temp IS NOT NULL
       ORDER BY ts DESC LIMIT 1`
    );

    const latest = rows[0];
    if (!latest) {
      return NextResponse.json({ temperature: null, timestamp: null });
    }

    return NextResponse.json({
      temperature: latest.outside_temp,
      // ts je Unix epoch v sekundách → ISO string
      timestamp: new Date(latest.ts * 1000).toISOString(),
    });
  } catch (error) {
    // Referenční teplota je nepovinný doplněk — při chybě vracíme null,
    // aby výpadek p100 databáze neshodil dlaždici teploty.
    return NextResponse.json({ temperature: null, timestamp: null });
  }
}
