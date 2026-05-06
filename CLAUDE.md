# Projekt meteopacetluky.cz

## Sběr dat

- Meteostanice **ABB free@home WS-1** na rodinném domě v Pacetlukách u Kroměříže
- Sběr dat provádí **Raspberry Pi Zero 2W** každých **60 sekund**
- RPi komunikuje přímo s ABB SysAP (IP **`192.168.68.56`**) přes lokální síť (HTTPS, Basic Auth)
- SysAP používá **self-signed certifikát** — flag `NODE_TLS_REJECT_UNAUTHORIZED=0` je zapečený přímo v `collect.mjs`
- Skript: `rpi/collect.mjs` — **dlouhoběžící daemon** (NE cron) jako systemd služba `meteo-collect.service`
- Data se ukládají do databáze **Turso** (SQLite v cloudu) přes HTTP Pipeline API
- Záložní sběr: GitHub Actions každých 10 minut přes ABB Cloud API (`scripts/collect-data.mjs`)
- Měřené veličiny: teplota, rychlost větru, jas (lux), detekce srážek

### Životnost SD karty

- Stará karta zemřela po 2 měsících kvůli cron PAM logům, journald persist, atd.
- Po reinstalaci přes `rpi/install.sh` všechny logy běží v RAM (journald volatile, `/dev/shm`)
- Disk se zapisuje jen při startu/shutdownu, swap je vypnutý, fstab má `noatime,commit=600`
- Odhadovaná životnost po optimalizaci: **5+ let** místo 2 měsíců

### Užitečné příkazy na RPi

```bash
sudo systemctl status meteo-collect       # stav
sudo journalctl -u meteo-collect -f       # live logy
tail -f /dev/shm/meteo.log                # debug log v RAM
sudo systemctl restart meteo-collect      # restart
cd ~/meteo && git pull && sudo systemctl restart meteo-collect  # update
```

- **Runbook pro nasazení / obnovu RPi**: viz `docs/rpi-setup-runbook.md`
- **Instalátor**: `rpi/install.sh` (jeden příkaz pro celý setup s optimalizacemi)

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
