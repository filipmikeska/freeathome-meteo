# API Reference

Všechny endpointy jsou relativní k základní URL aplikace (https://meteopacetluky.cz).
Kromě `/api/collect` jsou všechny `GET` a bez autentizace. Časy z DB jsou v UTC ve formátu
`YYYY-MM-DD HH:MM:SS`.

| Endpoint | Popis |
|----------|-------|
| [`GET /api/current`](#get-apicurrent) | Poslední měření |
| [`GET /api/history`](#get-apihistory) | Historie pro grafy |
| [`GET /api/brightness-days`](#get-apibrightness-days) | Kalendář jasu: dny s daty a hodiny jasna |
| [`GET /api/stats`](#get-apistats) | Dnešní min/max a minuty srážek |
| [`GET /api/reference-temp`](#get-apireference-temp) | Referenční teplota z kotle Viessmann |
| [`GET /api/forecast`](#get-apiforecast-a-get-apiforecast-yr) | Předpověď Open-Meteo |
| [`GET /api/forecast-yr`](#get-apiforecast-a-get-apiforecast-yr) | Předpověď Yr.no |
| [`GET /api/forecast-accuracy`](#get-apiforecast-accuracy) | Přesnost předpovědí za 30 dní |
| [`GET /api/moon`](#get-apimoon) | Fáze Měsíce, východ a západ |
| [`GET /api/radar`](#get-apiradar) | Seznam snímků radaru ČHMÚ |
| [`GET /api/radar/image`](#get-apiradarimage) | Zpracovaný snímek radaru (PNG) |
| [`POST /api/collect`](#post-apicollect) | Příjem měření (chráněno API klíčem) |

## GET /api/current

Poslední záznam z tabulky `measurements`. Odpověď se necachuje.

```json
{
  "timestamp": "2026-11-13 14:30:00",
  "temperature": 8.5,
  "brightness": 45000,
  "windSpeed": 3.2,
  "rain": 0,
  "tempAlarm": 0,
  "brightnessAlarm": 0,
  "windAlarm": 0,
  "rainAlarm": 0
}
```

Pokud v DB nejsou data, vrací `404 { "error": "No data available" }`.

## GET /api/history

| Parametr | Popis |
|----------|-------|
| `range` | `24h` (výchozí, i pro neznámou hodnotu), `7d`, `30d` |
| `from`, `to` | Vlastní rozsah (ISO 8601 nebo `YYYY-MM-DD HH:MM:SS`). Má přednost před `range`. `from` musí být před `to`, jinak `400`. |

Zdroj dat (`resolution` v odpovědi):

| Rozsah | `resolution` | Zdroj | Pole navíc |
|--------|--------------|-------|------------|
| `24h`, vlastní do 48 h | `raw` | `measurements` (max. 5000 řádků) | `rain` |
| `7d`, vlastní do 14 dní | `hourly` | `hourly_aggregates` | `tempMin`, `tempMax`, `brightnessMax`, `windMax`, `rainMinutes` |
| `30d`, vlastní nad 14 dní | `daily` | `daily_aggregates` (celé dny včetně prvního) | stejná jako u `hourly` |

`range` v odpovědi určuje formát popisků osy grafu. U vlastního rozsahu ho API odvodí z délky:
do 24 h `24h`, raw/hourly `7d`, daily `30d`.

```json
{
  "range": "24h",
  "resolution": "raw",
  "from": "2026-11-12 14:30:00",
  "to": "2026-11-13 14:30:00",
  "count": 1440,
  "data": [
    { "timestamp": "2026-11-12 14:31:00", "temperature": 8.3, "brightness": 12000, "windSpeed": 2.1, "rain": 0 }
  ]
}
```

## GET /api/brightness-days

Podklad pro kalendář v okně „Průběh jasu“. Vrací dny jednoho pražského kalendářního měsíce,
pro které jsou v `measurements` data jasu, a kolik minut byl jas nad hranicí jasno.

| Parametr | Popis |
|----------|-------|
| `month` | `YYYY-MM`, výchozí je aktuální měsíc. Jiný formát vrací `400`. |

Hranice jasno je 70 % jasu jasné oblohy při dané výšce Slunce (`clearThresholdLux` v
`src/lib/utils.js`). Pod 3° nad obzorem se nevyhodnocuje. Minuty se počítají stejně jako souhrn
v okně: každé měření platí do dalšího, nejvýš 10 minut. Endpoint čte minutová data za celý měsíc
(v létě ~26 000 řádků, ~1 s). Proto má CDN cache: uplynulé měsíce 1 den, aktuální měsíc 10 minut.

```json
{
  "month": "2026-11",
  "firstDay": "2026-03-31",
  "today": "2026-11-13",
  "days": {
    "2026-11-08": { "samples": 1439, "clearMinutes": 336 }
  }
}
```

`firstDay` je první den v DB (dál zpět kalendář nepustí). Dny bez dat v `days` chybí.

## GET /api/stats

Minimum a maximum za dnešek (od pražské půlnoci) včetně času naměření a počet minut se srážkami.

```json
{
  "temperature": { "min": { "value": 2.1, "timestamp": "…" }, "max": { "value": 9.8, "timestamp": "…" } },
  "brightness":  { "min": { … }, "max": { … } },
  "wind":        { "min": { … }, "max": { … } },
  "rain": { "totalMinutes": 12, "totalMeasurements": 870 }
}
```

`totalMinutes` je počet měření s `rain = 1`. Při sběru 1× za minutu odpovídá minutám.

## GET /api/reference-temp

Poslední venkovní teplota z čidla kotle Viessmann. Čte tabulku `heating_snapshots` v samostatné
Turso DB projektu p100 (`P100_DATABASE_URL`, `P100_AUTH_TOKEN`).

```json
{ "temperature": 7.9, "timestamp": "2026-11-13T14:29:00.000Z" }
```

Při chybě nebo chybějící konfiguraci vrací `{ "temperature": null, "timestamp": null }` se stavem 200.

## GET /api/forecast a GET /api/forecast-yr

7denní předpověď pro Pacetluky (49.3794, 17.5658): `/api/forecast` z Open-Meteo, `/api/forecast-yr`
z Yr.no (met.no). Obě vracejí stejný tvar, vždy jen od dneška dál.

```json
{
  "location": { "lat": 49.3794, "lon": 17.5658, "name": "Pacetluky" },
  "updatedAt": "2026-11-13T14:00:00.000Z",
  "daily": [
    { "date": "2026-11-13", "weatherCode": 3, "tempMax": 9.1, "tempMin": 2.4,
      "precipitation": 0.2, "windMax": 14.8, "windDirection": 250,
      "sunrise": "2026-11-13T07:00", "sunset": "2026-11-13T16:16" }
  ],
  "hourly": {
    "2026-11-13": [
      { "time": "15:00", "temperature": 8.2, "feelsLike": 5.9, "precipitation": 0,
        "precipitationProbability": 10, "weatherCode": 3, "windSpeed": 12.1, "humidity": 78 }
    ]
  }
}
```

- Rychlost větru je v **km/h** (Yr.no ji převádí z m/s). Do `forecast_snapshots` se ukládá převedená na m/s.
- Yr.no neposkytuje `feelsLike`, `precipitationProbability` ani `sunrise`/`sunset`. Tato pole jsou `null`.
- Odpověď se drží 1 h v paměti funkce. Při výpadku zdroje se vrátí paměťová cache, jinak `forecast_cache`
  z DB. V obou případech má odpověď `"stale": true`, u DB cache navíc `cacheUpdatedAt`.
- Při prvním úspěšném stažení v daném dni se uloží snapshot do `forecast_snapshots`.

## GET /api/forecast-accuracy

Porovná předpověď „na dnešek“ (horizont 0) z `forecast_snapshots` se skutečností v `daily_aggregates`
za posledních 30 dní.

```json
{
  "period": { "from": "2026-10-14", "to": "2026-11-13" },
  "summary": {
    "open-meteo": { "tempMAE": 1.4, "windMAE": 2.1, "rainAccuracy": 77, "days": 26 },
    "yr":         { "tempMAE": 1.2, "windMAE": 1.8, "rainAccuracy": 81, "days": 26 }
  },
  "comparisons": [ { "date": "…", "source": "yr", "forecast": { … }, "actual": { … }, "errors": { … } } ]
}
```

`tempMAE` je průměrná absolutní chyba přes `tempMax` i `tempMin`. `rainAccuracy` je podíl dnů (v %),
kdy předpověď srážek souhlasila se skutečností.

## GET /api/moon

Počítá se lokálně (`src/lib/moon.js`, `astronomy-engine`), bez externí služby.

```json
{
  "date": "2026-11-13",
  "phase": "Waning Crescent",
  "illumination": 12,
  "moonrise": "04:51",
  "moonset": "15:02",
  "upcoming": [
    { "phase": "New Moon", "date": "16. 11.", "time": "08:12", "year": 2026, "day": 16, "month": 11 }
  ]
}
```

Formát je stejný, jaký dříve vracelo USNO API, proto jsou názvy fází anglicky. Překlad dělá komponenta
`MoonPhase`. `phase` je hlavní fáze (`New Moon`, `First Quarter`, `Full Moon`, `Last Quarter`), pokud
nastává dnes, jinak mezifáze (`Waxing/Waning Crescent/Gibbous`). `upcoming` obsahuje 4 nejbližší hlavní fáze.
Časy jsou v pražském čase.

## GET /api/radar

Seznam snímků radarového kompozitu ČHMÚ (pseudoCAPPI 2 km) za posledních `hours` hodin
(výchozí 3, max. 24). Seznam se cachuje 60 s.

```json
{
  "base": "https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/",
  "frames": [ { "filename": "pacz2gmaps3.z_cappi020.20261113.1420.0.png", "timestamp": 1794666000 } ],
  "bounds": { "southWest": [48.047, 11.267], "northEast": [51.458, 19.624] }
}
```

`timestamp` je Unix čas v sekundách (UTC). Při chybě ČHMÚ vrací `502`.

## GET /api/radar/image

`?f=<filename>` vrátí snímek ČHMÚ jako PNG s průhledným pozadím (odstraněný rámeček, text a šedý
radarový stín). Snímek se cachuje 300 s. Název musí začínat `pacz2gmaps3`, jinak vrací `400`.

## POST /api/collect

Uloží měření do `measurements`. Používá ho `scripts/collect-data.mjs` s `COLLECT_VIA_API=true`.
RPi i GitHub Actions dnes zapisují přímo do Turso, takže endpoint běžně nic nevolá.

Hlavičky: `Content-Type: application/json`, `x-api-key: <COLLECT_API_KEY>`

```json
{
  "temperature": 8.5,
  "brightness": 45000,
  "windSpeed": 3.2,
  "rain": 0,
  "tempAlarm": 0,
  "brightnessAlarm": 0,
  "windAlarm": 0,
  "rainAlarm": 0
}
```

| Stav | Význam |
|------|--------|
| `200` | `{ "success": true }` |
| `400` | Chybí `temperature`, `brightness`, `windSpeed` nebo `rain` |
| `401` | Chybějící nebo neplatný klíč, nebo `COLLECT_API_KEY` není nastaven |

Endpoint vkládá jen do `measurements` s časem `datetime('now')`. Hodinové a denní agregace nepřepočítává.
