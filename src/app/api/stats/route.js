import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Direct Turso query (same approach as db.js)
async function execute(sql, args = []) {
  let url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url?.startsWith('libsql://')) url = url.replace('libsql://', 'https://');

  const stmtArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number')
      return Number.isInteger(a)
        ? { type: 'integer', value: String(a) }
        : { type: 'float', value: a };
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
    // Today's date in UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const from = todayStart.toISOString().slice(0, 19).replace('T', ' ');
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Get min/max for each metric with timestamps
    const [tempMin] = await execute(
      `SELECT temperature as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND temperature IS NOT NULL
       ORDER BY temperature ASC LIMIT 1`,
      [from, now]
    );
    const [tempMax] = await execute(
      `SELECT temperature as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND temperature IS NOT NULL
       ORDER BY temperature DESC LIMIT 1`,
      [from, now]
    );
    const [brightMin] = await execute(
      `SELECT brightness as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND brightness IS NOT NULL
       ORDER BY brightness ASC LIMIT 1`,
      [from, now]
    );
    const [brightMax] = await execute(
      `SELECT brightness as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND brightness IS NOT NULL
       ORDER BY brightness DESC LIMIT 1`,
      [from, now]
    );
    const [windMin] = await execute(
      `SELECT wind_speed as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND wind_speed IS NOT NULL
       ORDER BY wind_speed ASC LIMIT 1`,
      [from, now]
    );
    const [windMax] = await execute(
      `SELECT wind_speed as value, timestamp FROM measurements
       WHERE timestamp >= ? AND timestamp <= ? AND wind_speed IS NOT NULL
       ORDER BY wind_speed DESC LIMIT 1`,
      [from, now]
    );

    // Rain minutes today
    const [rainStats] = await execute(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN rain = 1 THEN 1 ELSE 0 END) as rain_count
       FROM measurements
       WHERE timestamp >= ? AND timestamp <= ?`,
      [from, now]
    );

    return NextResponse.json({
      temperature: { min: tempMin || null, max: tempMax || null },
      brightness: { min: brightMin || null, max: brightMax || null },
      wind: { min: windMin || null, max: windMax || null },
      rain: {
        totalMinutes: rainStats?.rain_count || 0,
        totalMeasurements: rainStats?.total || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
