/**
 * Test připojení k ABB API — ověří, že credentials fungují a meteostanice odpovídá.
 * Spuštění: node scripts/check-connection.mjs
 *
 * Pro lokální API: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/check-connection.mjs
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const DEVICE_ID = process.env.ABB_DEVICE_ID || '7EB10000329B';
const mode = process.env.ABB_API_MODE || 'cloud';

async function testLocal() {
  const host = process.env.ABB_LOCAL_HOST || '192.168.68.55';
  const user = process.env.ABB_LOCAL_USER || 'installer';
  const password = process.env.ABB_LOCAL_PASSWORD;

  if (!password) {
    console.error('ABB_LOCAL_PASSWORD is not set');
    return false;
  }

  const auth = Buffer.from(`${user}:${password}`).toString('base64');
  const url = `https://${host}/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/${DEVICE_ID}.ch0002.odp0001`;

  console.log(`Testing local API: ${host}`);
  console.log(`  URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      console.error(`  HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    const temp = data['00000000-0000-0000-0000-000000000000']?.values?.[0];
    console.log(`  Temperature: ${temp} °C`);
    console.log('  Local API: OK');
    return true;
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    if (err.message.includes('self-signed') || err.message.includes('CERT')) {
      console.log('  Tip: Run with NODE_TLS_REJECT_UNAUTHORIZED=0');
    }
    return false;
  }
}

async function testCloud() {
  const sysapUuid = process.env.ABB_SYSAP_UUID;
  const token = process.env.ABB_CLOUD_TOKEN;
  const subscriptionKey = process.env.ABB_CLOUD_SUBSCRIPTION_KEY;

  if (!token) {
    console.error('ABB_CLOUD_TOKEN is not set');
    return false;
  }
  if (!subscriptionKey) {
    console.error('ABB_CLOUD_SUBSCRIPTION_KEY is not set');
    return false;
  }

  const url = `https://apim.eu.mybuildings.abb.com/fhapi/v1/api/rest/datapoint/${sysapUuid}/${DEVICE_ID}.ch0002.odp0001`;

  console.log('Testing cloud API...');
  console.log(`  SysAP UUID: ${sysapUuid}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!response.ok) {
      console.error(`  HTTP ${response.status}: ${response.statusText}`);
      const body = await response.text();
      console.error(`  Body: ${body}`);
      return false;
    }

    const data = await response.json();
    const temp = data[sysapUuid]?.values?.[0];
    console.log(`  Temperature: ${temp} °C`);
    console.log('  Cloud API: OK');
    return true;
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== ABB free@home Connection Check ===');
  console.log(`Mode: ${mode}`);
  console.log(`Device: ${DEVICE_ID}`);
  console.log('');

  const ok = mode === 'local' ? await testLocal() : await testCloud();

  console.log('');
  if (ok) {
    console.log('Connection successful!');
  } else {
    console.log('Connection FAILED. Check your credentials and network.');
    process.exit(1);
  }
}

main();
