# Projekt meteopacetluky.cz

## Sběr dat

- Meteostanice **ABB free@home WS-1** na rodinném domě v Pacetlukách u Kroměříže
- Sběr dat provádí **Raspberry Pi Zero 2W** každých **60 sekund**
- RPi komunikuje přímo s ABB SysAP (IP **`192.168.68.56`**) přes lokální síť (HTTPS, Basic Auth)
- SysAP používá **self-signed certifikát** → skript musí běžet s `NODE_TLS_REJECT_UNAUTHORIZED=0`
- Skript: `rpi/collect.mjs`, cron běží jako `raspi@raspberrypi` každou minutu
- Data se ukládají do databáze **Turso** (SQLite v cloudu) přes HTTP Pipeline API
- Záložní sběr: GitHub Actions každých 10 minut přes ABB Cloud API (`scripts/collect-data.mjs`)
- Měřené veličiny: teplota, rychlost větru, jas (lux), detekce srážek
- **Runbook pro nasazení / obnovu RPi**: viz `docs/rpi-setup-runbook.md`

## Nasazení na produkci

- Hosting: **Vercel** (free tier)
- Framework: **Next.js 14** (App Router)
- Repozitář: `github.com/filipmikeska/freeathome-meteo`, branch `main`
- Vercel **nemá zapnutý auto-deploy z gitu** — je třeba nasadit ručně příkazem:
  ```
  npx vercel --prod
  ```
- Postup: commit → `git push` → `npx vercel --prod`
- Build trvá cca 30-40 sekund
- Produkční URL: **https://meteopacetluky.cz**
