// Dočasná smyčka pro sběr dat z PC, zatímco RPi nefunguje.
// Spouští collect.mjs každých 60 sekund, loguje do collect.log.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appendFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, 'logs');
const LOG_FILE = join(LOG_DIR, 'collect.log');

mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(LOG_FILE, line);
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn('node', ['collect.mjs'], {
      cwd: __dirname,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    });

    let stderrBuf = '';
    child.stdout.on('data', (d) => {
      const text = d.toString();
      process.stdout.write(text);
      appendFileSync(LOG_FILE, text);
    });
    child.stderr.on('data', (d) => {
      stderrBuf += d.toString();
    });

    child.on('close', (code) => {
      // Odfiltruj jen TLS varovani z stderr, zbytek do logu
      const filtered = stderrBuf
        .split('\n')
        .filter((l) => !l.includes('NODE_TLS_REJECT_UNAUTHORIZED') && !l.includes('trace-warnings'))
        .join('\n');
      if (filtered.trim()) {
        process.stderr.write(filtered);
        appendFileSync(LOG_FILE, filtered);
      }
      resolve(code);
    });
  });
}

log('=== START loop.mjs (PC docasny sber, kazdych 60s) ===');

let running = true;
process.on('SIGINT', () => {
  log('=== STOP (SIGINT) ===');
  running = false;
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('=== STOP (SIGTERM) ===');
  running = false;
  process.exit(0);
});

while (running) {
  try {
    await runOnce();
  } catch (e) {
    log(`CHYBA: ${e.message}`);
  }
  if (!running) break;
  await new Promise((r) => setTimeout(r, 60000));
}
