# Nastaveni ABB API

| API | Kdo ho pouziva |
|-----|----------------|
| Lokalni (SysAP v LAN) | Raspberry Pi (`rpi/collect.mjs`, primarni sber), lokalni vyvoj a diagnostika |
| Cloud | GitHub Actions (`scripts/collect-data.mjs`, zalozni sber) |

Prepinani rezimu ve `scripts/collect-data.mjs` a `scripts/check-connection.mjs` dela `ABB_API_MODE` (`local` / `cloud`).
`rpi/collect.mjs` pouziva vzdy lokalni API.

## Lokalni API

Lokalni API je dostupne primo na System Access Pointu ve vasi lokalni siti.
IP SysAPu je `192.168.68.56`. Starsi dokumentace uvadela `.55`, pri problemech ji overte v routeru.

### Predpoklady
- PC ve stejne siti jako SysAP (192.168.68.56)
- Ucet `installer` na SysAPu

### Otestovani
```bash
# Windows/Linux — ignoruje self-signed certifikat
curl -k -u installer:VASE_HESLO \
  https://192.168.68.56/fhapi/v1/api/rest/datapoint/00000000-0000-0000-0000-000000000000/7EB10000329B.ch0002.odp0001
```

Odpoved by mela vypadat:
```json
{ "00000000-0000-0000-0000-000000000000": { "values": ["12.5"] } }
```

### Konfigurace pro lokalni vyvoj
V `.env.local`:
```
ABB_API_MODE=local
ABB_LOCAL_HOST=192.168.68.56
ABB_LOCAL_USER=installer
ABB_LOCAL_PASSWORD=vase_heslo
```

Pri spusteni skriptu s self-signed certifikatem:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/check-connection.mjs
```

`rpi/collect.mjs` ma `NODE_TLS_REJECT_UNAUTHORIZED=0` nastavene primo v kodu, flag neni potreba.

## Cloud API (zalozni sber)

Cloud API je nutne pro GitHub Actions (neni pristup k lokalni siti).

### 1. Registrace na ABB Developer Portal

1. Jdete na [developer.eu.mybuildings.abb.com](https://developer.eu.mybuildings.abb.com)
2. Vytvorte ucet (pouzijte stejny email jako pro ABB myBuildings)
3. Po prihlaseni jdete do "Products" → "free@home Cloud API"
4. Kliknete "Subscribe" na plan (Free tier)

### 2. Ziskani Subscription Key

Po subscribe se zobrazi klic v sekci "Subscriptions":
- **Primary Key** — pouzijte jako `ABB_CLOUD_SUBSCRIPTION_KEY`

### 3. Ziskani OAuth2 tokenu

Cloud API pouziva OAuth2 autorizaci. Token ziskate pres:
1. ABB Developer Portal → "Authorization" sekce
2. Autorizujte pristup k vasemu SysAPu
3. Ziskany Bearer token pouzijte jako `ABB_CLOUD_TOKEN`

### Poznamky

- Token ma omezenou platnost — bude treba obcas obnovit
- Dokumentace: https://developer.eu.mybuildings.abb.com/fah_cloud
- Meteostanice Device ID: `7EB10000329B`
- SysAP UUID: `8cf4903d-885c-43ef-9fea-bba1167b5928`

### Datapointy meteostanice

| Velicina | Kanal | Datapoint | Popis |
|----------|-------|-----------|-------|
| Jas | ch0000 | odp0001 | Aktualni osvit v lux |
| Dest | ch0001 | odp0000 | 0 = neprsi, 1 = prsi |
| Teplota | ch0002 | odp0001 | Teplota ve °C |
| Vitr | ch0003 | odp0001 | Rychlost v m/s |
