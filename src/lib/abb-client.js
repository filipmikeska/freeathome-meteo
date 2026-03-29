const DEVICE_ID = process.env.ABB_DEVICE_ID || '7EB10000329B';

// Mapování kanálů meteostanice
const CHANNELS = {
  brightness: { channel: 'ch0000', datapoint: 'odp0001', alarm: 'odp0000' },
  rain:       { channel: 'ch0001', datapoint: 'odp0000', alarm: 'odp0000' },
  temperature:{ channel: 'ch0002', datapoint: 'odp0001', alarm: 'odp0000' },
  wind:       { channel: 'ch0003', datapoint: 'odp0001', alarm: 'odp0000' },
};

// Přečte jednu hodnotu z lokálního API
async function readLocalDatapoint(channel, datapoint) {
  const host = process.env.ABB_LOCAL_HOST || '192.168.68.55';
  const user = process.env.ABB_LOCAL_USER || 'installer';
  const password = process.env.ABB_LOCAL_PASSWORD;

  if (!password) throw new Error('ABB_LOCAL_PASSWORD is not set');

  const url = `https://${host}/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/${DEVICE_ID}.${channel}.${datapoint}`;
  const auth = Buffer.from(`${user}:${password}`).toString('base64');

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    // Self-signed certifikát — v Node.js 18+ nutno nastavit NODE_TLS_REJECT_UNAUTHORIZED=0
  });

  if (!response.ok) {
    throw new Error(`Local API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Odpověď: { "00000000-0000-0000-0000-000000000000": { "values": ["5.15"] } }
  const uuid = '00000000-0000-0000-0000-000000000000';
  return parseFloat(data[uuid]?.values?.[0] ?? '0');
}

// Přečte jednu hodnotu z cloud API
async function readCloudDatapoint(channel, datapoint) {
  const sysapUuid = process.env.ABB_SYSAP_UUID;
  const token = process.env.ABB_CLOUD_TOKEN;
  const subscriptionKey = process.env.ABB_CLOUD_SUBSCRIPTION_KEY;

  if (!token) throw new Error('ABB_CLOUD_TOKEN is not set');
  if (!subscriptionKey) throw new Error('ABB_CLOUD_SUBSCRIPTION_KEY is not set');

  const url = `https://apim.eu.mybuildings.abb.com/fhapi/v1/api/rest/datapoint/${sysapUuid}/${DEVICE_ID}.${channel}.${datapoint}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const values = data[sysapUuid]?.values;
  return parseFloat(values?.[0] ?? '0');
}

// Přečte jeden datapoint podle zvoleného režimu
function readDatapoint(channel, datapoint) {
  const mode = process.env.ABB_API_MODE || 'cloud';
  if (mode === 'local') {
    return readLocalDatapoint(channel, datapoint);
  }
  return readCloudDatapoint(channel, datapoint);
}

// Přečte všechny veličiny z meteostanice najednou
export async function readAllSensors() {
  const [temperature, brightness, windSpeed, rain] = await Promise.all([
    readDatapoint(CHANNELS.temperature.channel, CHANNELS.temperature.datapoint),
    readDatapoint(CHANNELS.brightness.channel, CHANNELS.brightness.datapoint),
    readDatapoint(CHANNELS.wind.channel, CHANNELS.wind.datapoint),
    readDatapoint(CHANNELS.rain.channel, CHANNELS.rain.datapoint),
  ]);

  // Přečteme i alarmové datapointy
  let tempAlarm = 0, brightnessAlarm = 0, windAlarm = 0, rainAlarm = 0;
  try {
    [tempAlarm, brightnessAlarm, windAlarm, rainAlarm] = await Promise.all([
      readDatapoint(CHANNELS.temperature.channel, CHANNELS.temperature.alarm),
      readDatapoint(CHANNELS.brightness.channel, CHANNELS.brightness.alarm),
      readDatapoint(CHANNELS.wind.channel, CHANNELS.wind.alarm),
      readDatapoint(CHANNELS.rain.channel, CHANNELS.rain.alarm),
    ]);
  } catch {
    // Alarm datapointy nemusí být vždy dostupné
  }

  return {
    temperature,
    brightness,
    windSpeed,
    rain: Math.round(rain), // 0 nebo 1
    tempAlarm: Math.round(tempAlarm),
    brightnessAlarm: Math.round(brightnessAlarm),
    windAlarm: Math.round(windAlarm),
    rainAlarm: Math.round(rainAlarm),
  };
}
