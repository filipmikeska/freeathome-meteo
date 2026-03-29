# Meteostanice ABB free@home

Webova aplikace pro zobrazeni a archivaci dat z meteostanice ABB free@home WS-1.

## Co aplikace dela

- **Dashboard** s aktualnimi hodnotami (teplota, vitr, jas, dest) — automaticke obnovovani kazdych 60s
- **Interaktivni grafy** historie — 24 hodin, 7 dni, 30 dni, vlastni rozsah
- **Vizualni indikatory** — barvy podle teploty, ikony pocasi, popis sily vetru
- **Automaticky sber dat** kazdych 10 minut pres GitHub Actions
- **REST API** pro pristup k aktualnim i historickym datum

## Technologie

| Vrstva | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel (free tier) |
| Databaze | Turso (libSQL/SQLite) |
| Sber dat | GitHub Actions (cron) |
| Grafy | Recharts |
| Styling | Tailwind CSS |

## Architektura

```
ABB Meteostanice → SysAP → ABB Cloud API
                                ↓
                    GitHub Actions (kazdych 10 min)
                                ↓
                          Turso DB (SQLite)
                                ↓
                    Next.js API Routes (Vercel)
                                ↓
                    Frontend (React + Recharts)
```

## Lokalni vyvoj

### Predpoklady

- Node.js 18+
- npm
- Ucet na [Turso](https://turso.tech) (free tier)

### Instalace

```bash
git clone https://github.com/YOUR_USERNAME/freeathome-meteo.git
cd freeathome-meteo
npm install
```

### Konfigurace

```bash
cp .env.example .env.local
```

Vyplnte hodnoty v `.env.local`:

- **TURSO_DATABASE_URL** — URL vasi Turso databaze (format: `libsql://db-name-username.turso.io`)
- **TURSO_AUTH_TOKEN** — autentizacni token z Turso CLI (`turso db tokens create db-name`)

Pro pripojeni k ABB meteostanici:
- **ABB_CLOUD_TOKEN** — OAuth2 token z [ABB Developer Portal](https://developer.eu.mybuildings.abb.com)
- **ABB_CLOUD_SUBSCRIPTION_KEY** — Subscription key z ABB Developer Portal

### Inicializace databaze

```bash
npm run migrate
```

### Testovaci data (volitelne)

```bash
npm run seed
```

Vygeneruje realisticka data za poslednich 30 dni.

### Spusteni

```bash
npm run dev
```

Aplikace bezi na [http://localhost:3000](http://localhost:3000).

## Nasazeni na Vercel

### 1. Vytvorte ucet na Turso

```bash
# Instalace Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Prihlaseni
turso auth login

# Vytvoreni databaze
turso db create freeathome-meteo

# Ziskani URL
turso db show freeathome-meteo --url

# Vygenerovani tokenu
turso db tokens create freeathome-meteo
```

### 2. Spustte migrace

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run migrate
```

### 3. Nasadte na Vercel

1. Push repozitar na GitHub
2. Propojte repozitar s [Vercel](https://vercel.com)
3. Nastavte environment promenne ve Vercel dashboardu:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `COLLECT_API_KEY` (vygenerujte nahodny retezec)
   - `NEXT_PUBLIC_POLL_INTERVAL` (volitelne, vychozi 60000)

### 4. Nastavte GitHub Actions

V GitHub repozitari → Settings → Secrets and variables → Actions:

| Secret | Popis |
|--------|-------|
| `ABB_SYSAP_UUID` | UUID vaseho System Access Pointu |
| `ABB_DEVICE_ID` | ID meteostanice (7EB10000329B) |
| `ABB_CLOUD_TOKEN` | OAuth2 Bearer token |
| `ABB_CLOUD_SUBSCRIPTION_KEY` | Subscription Key z ABB portalu |
| `TURSO_DATABASE_URL` | URL Turso databaze |
| `TURSO_AUTH_TOKEN` | Auth token Turso |

Workflow `collect-data.yml` se automaticky spousti kazdych 10 minut.

## API Endpointy

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/api/current` | GET | Posledni namerene hodnoty |
| `/api/history?range=24h` | GET | Historie (24h, 7d, 30d) |
| `/api/history?from=X&to=Y` | GET | Vlastni casovy rozsah (ISO 8601) |
| `/api/collect` | POST | Prijem dat (vyzaduje `x-api-key` header) |

## Struktura projektu

```
src/
├── app/
│   ├── layout.js          # Root layout
│   ├── page.js            # Dashboard
│   ├── globals.css        # Tailwind styly
│   └── api/               # API routes
├── components/            # React komponenty
├── hooks/                 # SWR hooks
└── lib/                   # DB klient, ABB klient, utility
scripts/                   # Migrace, seed, sber dat
.github/workflows/         # CI/CD a sber dat
```

## Licence

MIT
