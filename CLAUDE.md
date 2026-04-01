# Projekt meteopacetluky.cz

## Sběr dat

- Meteostanice **ABB free@home WS-1** na rodinném domě v Pacetlukách u Kroměříže
- Sběr dat provádí **Raspberry Pi Zero 2W** každých **60 sekund**
- RPi komunikuje přímo s ABB SysAP přes lokální síť (HTTPS, Basic Auth)
- Skript: `rpi/collect.mjs`
- Data se ukládají do databáze **Turso** (SQLite v cloudu) přes HTTP Pipeline API
- Záložní sběr: GitHub Actions každých 10 minut přes ABB Cloud API (`scripts/collect-data.mjs`)
- Měřené veličiny: teplota, rychlost větru, jas (lux), detekce srážek

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
