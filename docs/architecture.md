# Architektura

## Prehled komponent

```
┌─────────────────────────────────────────┐
│           ABB free@home System           │
│                                         │
│  Meteostanice WS-1 ──→ SysAP           │
│  (7EB10000329B)      (192.168.68.55)   │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   Local API          Cloud API
   (Basic Auth)       (OAuth2)
        │                   │
        └─────────┬─────────┘
                  │
    ┌─────────────┴─────────────┐
    │     GitHub Actions         │
    │   (cron: kazdych 10 min)  │
    │   scripts/collect-data.mjs │
    └─────────────┬─────────────┘
                  │
    ┌─────────────┴─────────────┐
    │        Turso DB            │
    │   (libSQL / SQLite)       │
    │                           │
    │   measurements (raw)      │
    │   hourly_aggregates       │
    │   daily_aggregates        │
    └─────────────┬─────────────┘
                  │
    ┌─────────────┴─────────────┐
    │   Next.js na Vercel        │
    │                           │
    │   /api/current            │
    │   /api/history            │
    │   /api/collect            │
    │                           │
    │   Frontend (React)        │
    │   - Dashboard             │
    │   - Grafy (Recharts)      │
    │   - Date Range Picker     │
    └───────────────────────────┘
```

## Datovy tok

1. **Sber dat**: GitHub Actions spousti `collect-data.mjs` kazdych 10 minut
2. Skript cte 4 veliciny z ABB Cloud API (teplota, jas, vitr, dest)
3. Data se ulozi do Turso DB (tabulka `measurements`)
4. Zaroven se aktualizuji hodinove a denni agregace
5. Frontend pres SWR polluje `/api/current` kazdych 60 sekund
6. Grafy ctou z `/api/history` s vybranym casovym rozsahem

## Databazove tabulky

- **measurements**: Raw data, kazdy zaznam = jedno cteni (~144/den)
- **hourly_aggregates**: Prumer/min/max za hodinu, pro 7-denni grafy
- **daily_aggregates**: Prumer/min/max za den, pro 30-denni grafy

## Retencni politika

- Raw data (measurements): 1 rok
- Hodinove agregace: neomezene
- Denni agregace: neomezene
