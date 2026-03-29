# Navod na nasazeni

## 1. Turso databaze

### Instalace CLI
```bash
# Linux/macOS
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (via scoop)
scoop install turso-cli
```

### Vytvoreni databaze
```bash
turso auth login
turso db create freeathome-meteo
turso db show freeathome-meteo --url    # → libsql://freeathome-meteo-xxx.turso.io
turso db tokens create freeathome-meteo  # → eyJhbGciOi...
```

### Migrace
```bash
export TURSO_DATABASE_URL=libsql://freeathome-meteo-xxx.turso.io
export TURSO_AUTH_TOKEN=eyJhbGciOi...
npm run migrate
```

## 2. Vercel

1. Vytvorte ucet na [vercel.com](https://vercel.com) (propojte s GitHub)
2. Importujte repozitar `freeathome-meteo`
3. Vercel automaticky detekuje Next.js

### Environment promenne na Vercelu

Jdete do: Project → Settings → Environment Variables

| Promenna | Hodnota |
|----------|---------|
| `TURSO_DATABASE_URL` | `libsql://freeathome-meteo-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | Token z Turso CLI |
| `COLLECT_API_KEY` | Nahodny retezec (napr. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_POLL_INTERVAL` | `60000` (volitelne) |

## 3. GitHub Actions — sber dat

### Nastaveni Secrets

V GitHub repozitari → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Kde ziskat |
|--------|-----------|
| `ABB_SYSAP_UUID` | `8cf4903d-885c-43ef-9fea-bba1167b5928` |
| `ABB_DEVICE_ID` | `7EB10000329B` |
| `ABB_CLOUD_TOKEN` | ABB Developer Portal → OAuth2 |
| `ABB_CLOUD_SUBSCRIPTION_KEY` | ABB Developer Portal → Subscriptions |
| `TURSO_DATABASE_URL` | Viz krok 1 |
| `TURSO_AUTH_TOKEN` | Viz krok 1 |

### Overeni

Po nastaveni secrets jdete do Actions → "Collect Weather Data" → "Run workflow" (rucni spusteni).
Zkontrolujte log — melo by se zobrazit "Stored directly to Turso DB".

## 4. ABB Cloud API pristup

Viz [abb-api-setup.md](abb-api-setup.md) pro detailni navod.

## Spotrana free tieru

| Sluzba | Limit | Nase spotreba |
|--------|-------|---------------|
| Vercel | 100GB bandwidth/mesic | ~1 GB |
| Turso | 9 GB storage, 500M rows read | ~5M rows/mesic |
| GitHub Actions | 2000 min/mesic | ~900 min (144 runu * ~1 min) |
