// Turso HTTP Pipeline API klient
// Používá přímé fetch volání místo @libsql/client (kompatibilita s Vercel + Node 24)

function getConfig() {
  let url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) throw new Error('TURSO_DATABASE_URL is not set');

  if (url.startsWith('libsql://')) {
    url = url.replace('libsql://', 'https://');
  }

  return { url: url.trim(), authToken };
}

// Provede SQL dotaz přes Turso HTTP Pipeline API
async function execute(sql, args = []) {
  const { url, authToken } = getConfig();

  const stmtArgs = args.map((a) => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') {
      return Number.isInteger(a)
        ? { type: 'integer', value: String(a) }
        : { type: 'float', value: a };
    }
    return { type: 'text', value: String(a) };
  });

  const response = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
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
    throw new Error(`Turso API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.results?.[0];

  if (result?.type === 'error') {
    throw new Error(`SQL error: ${result.error?.message}`);
  }

  const execResult = result?.response?.result;
  if (!execResult) return { rows: [], columns: [] };

  // Převedeme Turso formát na jednodušší rows
  const columns = execResult.cols?.map((c) => c.name) || [];
  const rows = (execResult.rows || []).map((row) => {
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

  return { rows, columns };
}

// === Public API ===

export async function insertMeasurement(data) {
  await execute(
    `INSERT INTO measurements (timestamp, temperature, brightness, wind_speed, rain,
        rain_alarm, temp_alarm, wind_alarm, brightness_alarm)
     VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.temperature,
      data.brightness,
      data.windSpeed,
      data.rain,
      data.rainAlarm ?? 0,
      data.tempAlarm ?? 0,
      data.windAlarm ?? 0,
      data.brightnessAlarm ?? 0,
    ]
  );
}

export async function getLatestMeasurement() {
  const { rows } = await execute(
    'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1'
  );
  return rows[0] || null;
}

export async function getHistory({ from, to, limit = 1000 }) {
  const { rows } = await execute(
    `SELECT * FROM measurements
     WHERE timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC LIMIT ?`,
    [from, to, limit]
  );
  return rows;
}

export async function getHourlyAggregates({ from, to }) {
  const { rows } = await execute(
    `SELECT * FROM hourly_aggregates
     WHERE hour BETWEEN ? AND ?
     ORDER BY hour ASC`,
    [from, to]
  );
  return rows;
}

export async function getDailyAggregates({ from, to }) {
  const { rows } = await execute(
    `SELECT * FROM daily_aggregates
     WHERE date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [from, to]
  );
  return rows;
}

export async function computeHourlyAggregate(hourStr) {
  const nextHour = new Date(new Date(hourStr).getTime() + 3600000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  await execute(
    `INSERT OR REPLACE INTO hourly_aggregates
       (hour, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
        wind_avg, wind_max, rain_minutes)
     SELECT ?,
       AVG(temperature), MIN(temperature), MAX(temperature),
       AVG(brightness), MAX(brightness),
       AVG(wind_speed), MAX(wind_speed),
       SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
     FROM measurements
     WHERE timestamp >= ? AND timestamp < ?`,
    [hourStr, hourStr, nextHour]
  );
}

export async function computeDailyAggregate(dateStr) {
  const nextDate = new Date(new Date(dateStr + 'T00:00:00Z').getTime() + 86400000)
    .toISOString()
    .slice(0, 10);

  await execute(
    `INSERT OR REPLACE INTO daily_aggregates
       (date, temp_avg, temp_min, temp_max, brightness_avg, brightness_max,
        wind_avg, wind_max, rain_total_minutes)
     SELECT ?,
       AVG(temperature), MIN(temperature), MAX(temperature),
       AVG(brightness), MAX(brightness),
       AVG(wind_speed), MAX(wind_speed),
       SUM(CASE WHEN rain = 1 THEN 10 ELSE 0 END)
     FROM measurements
     WHERE timestamp >= ? AND timestamp < ?`,
    [dateStr, dateStr + ' 00:00:00', nextDate + ' 00:00:00']
  );
}

export async function cleanupOldMeasurements(retentionDays = 365) {
  await execute(
    `DELETE FROM measurements WHERE timestamp < datetime('now', ?)`,
    [`-${retentionDays} days`]
  );
}
