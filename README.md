# Meteostanice Pacetluky — meteopacetluky.cz

Webová aplikace pro zobrazení a archivaci dat z meteostanice **ABB free@home WS-1**
na rodinném domě v Pacetlukách u Kroměříže.

Produkce: **https://meteopacetluky.cz**

## Co aplikace umí

Záložka **Počasí**
- Aktuální hodnoty: teplota, rychlost větru, jas (lux), srážky. Obnovují se každých 60 s.
- Referenční venkovní teplota z čidla kotle Viessmann (volitelná, z jiné databáze).
- Dnešní minima a maxima podle pražského dne (klik na dlaždici).
- Stav oblohy na dlaždici **Jas** (Jasno / Polojasno / Oblačno / Zataženo) porovnává naměřený jas
  s jasem jasné oblohy při aktuální výšce Slunce. Model jasné oblohy vychází z vlastních měření
  (`clearSkyLux` v `src/lib/utils.js`); „Jasno“ znamená aspoň 70 % jasu jasné oblohy.
- Klik na dlaždici **Jas** otevře průběh jasu během dne s hranicí „jasno“ podle stejného modelu.
  Hranice je křivka (ráno a v zimě nižší) a okno ukazuje, jak dlouho byl jas nad ní.
  Slouží k odhadu, jestli fotovoltaika ohřála vodu. Šipkami lze listovat do minulých dnů.
  Klik na datum otevře kalendář. Vybrat jde jen den s daty a u každého dne jsou hodiny nad hranicí jasno.
- Interaktivní grafy: 24 h, 7 dní, 30 dní a vlastní rozsah. U agregovaných dat se zobrazuje pás min–max.
  U jasu graf ukazuje hranici „jasno“ (u 24 h a 7 dní) a celkový čas nad ní za zobrazené období.
- Východ a západ Slunce, fáze Měsíce. Fáze Měsíce se počítá lokálně přes `astronomy-engine`.

Záložka **Předpověď**
- 7denní předpověď z **Open-Meteo** a **Yr.no** s hodinovým detailem.
- Přesnost předpovědí za posledních 30 dní (porovnání s naměřenými hodnotami).

Záložka **Radar**
- Srážkový radar ČHMÚ na mapě (Leaflet + OSM), animace posledních 3 hodin.

Dále: PWA (instalace na plochu), tmavý režim, Vercel Analytics.

## Architektura

```
Meteostanice WS-1 ──► ABB SysAP (192.168.68.56)
                          │                    │
              lokální API (HTTPS, Basic Auth)   ABB Cloud API (OAuth2)
                          │                    │
   Raspberry Pi Zero 2W   │                    │   GitHub Actions (záloha)
   rpi/collect.mjs        │                    │   scripts/collect-data.mjs
   daemon, každých 60 s ◄─┘                    └─► každých 10 min
                          │                    │
                          └──────► Turso DB ◄──┘
                                  (libSQL / SQLite, HTTP Pipeline API)
                                      │
                         Next.js 14 API routes (Vercel)
                                      │        ▲ Open-Meteo, Yr.no, ČHMÚ radar
                                      ▼
                          Frontend (React, SWR, Recharts)
```

Podrobnosti najdete v [docs/architecture.md](docs/architecture.md).

## Technologie

| Vrstva | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router), React 18 |
| Hosting | Vercel (free tier), deploy ručně |
| Databáze | Turso (libSQL/SQLite), přístup přes HTTP Pipeline API |
| Primární sběr dat | Raspberry Pi Zero 2W, systemd daemon `meteo-collect` |
| Záložní sběr dat | GitHub Actions (cron každých 10 min, ABB Cloud API) |
| Grafy | Recharts |
| Mapa radaru | Leaflet + OSM, zpracování snímků přes `sharp` |
| Astronomie | `astronomy-engine` |
| Styling | Tailwind CSS |

## Struktura projektu

```
src/
├── app/
│   ├── page.js, layout.js       # Stránka a root layout (metadata, PWA)
│   └── api/                     # API routes, viz docs/api-reference.md
├── components/                  # Dashboard, CurrentWeather, WeatherChart, ForecastCard,
│                                # ForecastAccuracy, RadarMap, MoonPhase, SunTimes, …
├── hooks/useWeatherData.js      # SWR hooky pro všechna API
└── lib/
    ├── db.js                    # Turso klient + dotazy
    ├── abb-client.js            # ABB lokální / cloud API
    ├── moon.js                  # Výpočet fáze Měsíce
    ├── weather-codes.js         # WMO kódy, mapování symbolů Yr.no
    └── utils.js
rpi/                             # Sběr dat na Raspberry Pi (daemon, instalátor, systemd unit)
scripts/                         # Migrace, seed, záložní sběr, diagnostika, ikony
docs/                            # Dokumentace
public/                          # Statické soubory, manifest, service worker
.github/workflows/               # CI (lint + build) a záložní sběr dat
```

## Lokální vývoj

Předpoklady: Node.js 20+, npm a přístup k databázi Turso.

```bash
npm install
cp .env.example .env.local   # doplňte hodnoty, viz tabulka níže
npm run migrate              # vytvoří tabulky (idempotentní)
npm run dev                  # http://localhost:3000
```

Volitelně `npm run seed` vygeneruje testovací data za 30 dní. Nespouštějte ho proti produkční DB.

### npm skripty

| Skript | Popis |
|--------|-------|
| `dev` / `build` / `start` / `lint` | Standardní Next.js příkazy |
| `migrate` | Vytvoří tabulky a indexy v Turso DB |
| `seed` | Testovací data |
| `collect` | Jednorázový sběr dat (záložní collector) |
| `check-connection` | Test spojení s ABB API (lokální i cloud) |
| `verify-moon` | Porovná výpočet fáze Měsíce s nezávislou knihovnou `astronomia` |

Jednorázové skripty: `node scripts/recompute-rain-minutes.mjs [--apply]` přepočítá minuty srážek v agregacích.

### Environment proměnné (web)

| Proměnná | Povinná | Popis |
|----------|---------|-------|
| `TURSO_DATABASE_URL` | ano | `libsql://…turso.io` |
| `TURSO_AUTH_TOKEN` | ano | Token z `turso db tokens create` |
| `P100_DATABASE_URL` | ne | Turso DB projektu p100 (zdroj referenční teploty z kotle) |
| `P100_AUTH_TOKEN` | ne | Token k té DB. Bez něj `/api/reference-temp` vrací `null`. |
| `COLLECT_API_KEY` | ne | Klíč pro `POST /api/collect`. Bez něj endpoint vždy vrací 401. |
| `NEXT_PUBLIC_POLL_INTERVAL` | ne | Interval obnovy aktuálních dat v ms (výchozí 60000) |

Proměnné pro sběr dat (`ABB_*`) popisuje [docs/abb-api-setup.md](docs/abb-api-setup.md).
Proměnné pro Raspberry Pi jsou v [rpi/.env.example](rpi/.env.example).

## Nasazení

Vercel **nemá zapnutý auto-deploy z gitu**. Postup:

```bash
git push
npx vercel --prod
```

Podrobnosti v [docs/deployment.md](docs/deployment.md).

## Dokumentace

| Dokument | Obsah |
|----------|-------|
| [docs/architecture.md](docs/architecture.md) | Komponenty, datový tok, DB schéma, cache |
| [docs/api-reference.md](docs/api-reference.md) | Všechny API endpointy |
| [docs/deployment.md](docs/deployment.md) | Turso, Vercel, GitHub Actions |
| [docs/abb-api-setup.md](docs/abb-api-setup.md) | ABB lokální a cloud API, datapointy |
| [docs/rpi-setup-runbook.md](docs/rpi-setup-runbook.md) | Instalace, update a diagnostika Raspberry Pi |

## Licence

MIT
