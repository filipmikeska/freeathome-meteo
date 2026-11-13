# Nasazení

## Běžný deploy (změna kódu webu)

Vercel **nemá zapnutý auto-deploy z gitu**. Po commitu je potřeba nasadit ručně:

```bash
git push
npx vercel --prod
```

Build trvá cca 30–40 s. Výsledek ověříte na https://meteopacetluky.cz.

Změny v `rpi/` se na Vercel nenasazují. Na Raspberry Pi je potřeba udělat `git pull` a restartovat
službu, viz [rpi-setup-runbook.md](rpi-setup-runbook.md#2-update-kódu-po-změně-v-githubu).

## CI

`.github/workflows/test.yml` spouští `npm run lint` a `npm run build` při pushi do `main` a u pull requestů.
CI nic nenasazuje.

---

## Nastavení od nuly

### 1. Turso databáze

```bash
# Instalace CLI: Linux/macOS
curl -sSfL https://get.tur.so/install.sh | bash
# Windows (scoop)
scoop install turso-cli

turso auth login
turso db create freeathome-meteo
turso db show freeathome-meteo --url     # → libsql://freeathome-meteo-xxx.turso.io
turso db tokens create freeathome-meteo  # → eyJhbGciOi...
```

Migrace (idempotentní, `CREATE … IF NOT EXISTS`):

```bash
# hodnoty v .env.local, nebo jako env proměnné
npm run migrate
```

### 2. Vercel

1. Importujte repozitář na [vercel.com](https://vercel.com). Next.js se detekuje automaticky.
2. Lokálně propojte projekt přes `npx vercel link`.
3. Nastavte env proměnné (Project → Settings → Environment Variables):

| Proměnná | Povinná | Hodnota |
|----------|---------|---------|
| `TURSO_DATABASE_URL` | ano | `libsql://freeathome-meteo-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | ano | Token z Turso CLI |
| `P100_DATABASE_URL` | ne | Turso DB projektu p100 (referenční teplota z kotle) |
| `P100_AUTH_TOKEN` | ne | Token k DB p100 |
| `COLLECT_API_KEY` | ne | Náhodný řetězec (`openssl rand -hex 32`), jen pokud se používá `POST /api/collect` |
| `NEXT_PUBLIC_POLL_INTERVAL` | ne | `60000` |

4. Doména `meteopacetluky.cz` je nastavená ve Vercel → Domains.

### 3. Sběr dat

- **Primární:** Raspberry Pi, viz [rpi-setup-runbook.md](rpi-setup-runbook.md).
- **Záložní:** GitHub Actions, viz níže. Potřebuje přístup k ABB Cloud API, viz [abb-api-setup.md](abb-api-setup.md).

#### GitHub Actions secrets

GitHub → Settings → Secrets and variables → Actions:

| Secret | Hodnota |
|--------|---------|
| `ABB_SYSAP_UUID` | UUID SysAPu (viz `.env.example`) |
| `ABB_DEVICE_ID` | `7EB10000329B` |
| `ABB_CLOUD_TOKEN` | OAuth2 Bearer token z ABB Developer Portalu |
| `ABB_CLOUD_SUBSCRIPTION_KEY` | Subscription key z ABB Developer Portalu |
| `TURSO_DATABASE_URL` | Viz krok 1 |
| `TURSO_AUTH_TOKEN` | Viz krok 1 |

Ověření: Actions → „Collect Weather Data“ → „Run workflow“. V logu má být „Stored directly to Turso DB“.

## Zátěž free tierů

| Služba | Odhad zátěže |
|--------|--------------|
| Vercel | Jednotky GB přenosu za měsíc |
| Turso | ~1440 zápisů/den z RPi + ~144 ze záložního sběru. Každý zápis přepočítá hodinovou a denní agregaci (čte až ~1500 řádků). |
| GitHub Actions | ~4300 běhů/měsíc. Pro veřejný repozitář jsou minuty zdarma. |

Aktuální limity free tierů ověřte na webech služeb, mění se.
