# Architektura

## Přehled komponent

```
┌──────────────────────────────────────────────┐
│            ABB free@home systém              │
│  Meteostanice WS-1  ──►  SysAP               │
│  (7EB10000329B)          192.168.68.56       │
└──────────┬──────────────────────┬────────────┘
           │ lokální API          │ Cloud API
           │ HTTPS + Basic Auth   │ OAuth2 + subscription key
           │ (self-signed cert)   │
┌──────────▼───────────┐  ┌───────▼──────────────────┐
│ Raspberry Pi Zero 2W │  │ GitHub Actions (záloha)  │
│ rpi/collect.mjs      │  │ scripts/collect-data.mjs │
│ systemd daemon, 60 s │  │ cron */10 min            │
└──────────┬───────────┘  └───────┬──────────────────┘
           └────────┬─────────────┘
          ┌─────────▼──────────────────────┐
          │ Turso DB (libSQL / SQLite)     │
          │ measurements, hourly/daily_    │
          │ aggregates, forecast_snapshots,│
          │ forecast_cache                 │
          └─────────┬──────────────────────┘
                    │      Turso DB p100-home (heating_snapshots)
                    │      ── referenční teplota z kotle Viessmann
          ┌─────────▼──────────────────────┐
          │ Next.js 14 na Vercelu          │◄── Open-Meteo, Yr.no (met.no)
          │ API routes (/api/*)            │◄── ČHMÚ radar (opendata.chmi.cz)
          │ Frontend: React, SWR, Recharts │
          └────────────────────────────────┘
```

## Sběr dat

### Primární: Raspberry Pi (`rpi/collect.mjs`)

- Dlouhoběžící Node proces spuštěný jako systemd služba `meteo-collect.service`. Nepoužívá cron.
- Každých 60 s přečte 4 datapointy ze SysAP přes lokální API. Zapíše řádek do `measurements` a přepočítá
  aktuální hodinu v `hourly_aggregates` a aktuální den v `daily_aggregates`.
- Je optimalizovaný pro životnost SD karty: logy jen v RAM (journald volatile, `/dev/shm/meteo.log`).
  Jediný soubor zapisovaný na kartu je marker `~/meteo/last-write.txt`, zhruba 1× za hodinu.
- Samoobnova: systemd `WatchdogSec=300`. Po 20 chybách v řadě se proces ukončí a po 5 neúspěšných
  startech za 3 h systemd rebootuje Pi. HW watchdog zapíná Pi OS.
- Instalace, update a diagnostika: [rpi-setup-runbook.md](rpi-setup-runbook.md).

`rpi/loop.mjs` je dočasná náhrada pro sběr z PC, když RPi nefunguje. Spouští `collect.mjs` a jeho výstup
loguje do `rpi/logs/collect.log`. Protože `collect.mjs` je dnes sám daemon, stačí na PC i přímo
`node rpi/collect.mjs`.

### Záložní: GitHub Actions (`scripts/collect-data.mjs`)

- Workflow `.github/workflows/collect-data.yml`, cron každých 10 min. Lze spustit i ručně (`workflow_dispatch`).
- Čte přes ABB Cloud API (`ABB_API_MODE=cloud`), protože GitHub runner nemá přístup do lokální sítě.
- Zapisuje přímo do Turso. Alternativně umí poslat data na `POST /api/collect`
  (`COLLECT_VIA_API=true`, `COLLECT_API_URL`, `COLLECT_API_KEY`).
- GitHub cron je nespolehlivý (běhy se zpožďují nebo vynechávají), proto jde jen o zálohu.

## Webová aplikace

- Frontend (`src/components/Dashboard.js`) má tři záložky synchronizované s URL parametrem `?tab=`:
  `weather` (výchozí), `forecast`, `radar`.
- Data načítají SWR hooky v `src/hooks/useWeatherData.js`. Aktuální hodnoty se obnovují podle
  `NEXT_PUBLIC_POLL_INTERVAL` (výchozí 60 s).
- Všechny endpointy popisuje [api-reference.md](api-reference.md).

### Externí zdroje a cache

| Zdroj | Endpoint | Cache |
|-------|----------|-------|
| Open-Meteo | `/api/forecast` | Paměť 1 h. Při výpadku paměťová cache, pak `forecast_cache` v DB (`stale: true`). |
| Yr.no (met.no) | `/api/forecast-yr` | Stejně jako Open-Meteo |
| ČHMÚ radar | `/api/radar`, `/api/radar/image` | Seznam snímků 60 s, obrázky 300 s (Next.js fetch cache) |
| Výpočet Měsíce | `/api/moon` | Bez externí služby (`src/lib/moon.js`, `astronomy-engine`) |
| Kotel Viessmann | `/api/reference-temp` | Čte jinou Turso DB (`P100_*`). Při chybě vrací `null`. |

Při prvním úspěšném stažení předpovědi v daném dni se uloží snapshot do `forecast_snapshots`.
Z nich `/api/forecast-accuracy` počítá přesnost předpovědí proti `daily_aggregates`.

## Databázové tabulky

Schéma je v `scripts/migrate.mjs`.

| Tabulka | Obsah |
|---------|-------|
| `measurements` | Raw data, jeden řádek na měření (~1440/den z RPi + případné záložní běhy) |
| `hourly_aggregates` | Průměr / min / max za hodinu, minuty srážek (`hour` je UNIQUE) |
| `daily_aggregates` | Průměr / min / max za den, minuty srážek = součet hodinových (`date` je UNIQUE) |
| `forecast_snapshots` | Denní předpověď (zdroj, datum, horizont) pro vyhodnocení přesnosti |
| `forecast_cache` | Poslední úspěšná odpověď předpovědního API (fallback při výpadku a cold startu) |

Časy v DB jsou v UTC ve formátu `YYYY-MM-DD HH:MM:SS`. Hodinové a denní agregace jsou po UTC
hodinách a dnech, jen `/api/stats` počítá „dnešek“ od pražské půlnoci.

**Minuty srážek** (`rain_minutes`) = podíl měření s `rain = 1` v hodině × pokryté minuty hodiny
(u probíhající hodiny jen uplynulé). Výpočet nezávisí na intervalu sběru (RPi 1×/min, záloha 1×/10 min).
Stejný SQL je ve třech collectorech: `rpi/collect.mjs`, `scripts/collect-data.mjs` a `src/lib/db.js`.
Při změně je potřeba upravit všechny tři. Data uložená starým výpočtem (10 min za každé měření, tedy až 10×
víc) přepočítá `scripts/recompute-rain-minutes.mjs`.

## Retence dat

Všechna data se zatím uchovávají neomezeně. V `src/lib/db.js` existuje `cleanupOldMeasurements()`
(maže `measurements` starší než 365 dní), ale nic ji nevolá.
