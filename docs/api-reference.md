# API Reference

Vsechny endpointy jsou relativni k zakladni URL aplikace.

## GET /api/current

Vrati posledni namerene hodnoty.

**Odpoved (200):**
```json
{
  "timestamp": "2026-03-29 14:30:00",
  "temperature": 12.5,
  "brightness": 45000,
  "windSpeed": 3.2,
  "rain": 0,
  "tempAlarm": 0,
  "brightnessAlarm": 0,
  "windAlarm": 0,
  "rainAlarm": 0
}
```

## GET /api/history

Vrati historicka data.

**Parametry:**
| Parametr | Typ | Popis |
|----------|-----|-------|
| `range` | string | Prednastaveny rozsah: `24h`, `7d`, `30d` |
| `from` | string | Zacatek vlastniho rozsahu (ISO 8601) |
| `to` | string | Konec vlastniho rozsahu (ISO 8601) |

- Pro `24h`: vraci raw data (kazdy zaznam)
- Pro `7d`: vraci hodinove agregace (avg/min/max)
- Pro `30d`: vraci denni agregace (avg/min/max)

**Odpoved (200):**
```json
{
  "range": "24h",
  "from": "2026-03-28T14:30:00.000Z",
  "to": "2026-03-29T14:30:00.000Z",
  "count": 144,
  "data": [
    {
      "timestamp": "2026-03-28 14:30:00",
      "temperature": 8.3,
      "brightness": 12000,
      "windSpeed": 2.1,
      "rain": 0
    }
  ]
}
```

## POST /api/collect

Prijme nova data a ulozi je do databaze. Chraneno API klicem.

**Hlavicky:**
- `Content-Type: application/json`
- `x-api-key: <COLLECT_API_KEY>`

**Telo:**
```json
{
  "temperature": 12.5,
  "brightness": 45000,
  "windSpeed": 3.2,
  "rain": 0,
  "tempAlarm": 0,
  "brightnessAlarm": 0,
  "windAlarm": 0,
  "rainAlarm": 0
}
```

**Odpoved (200):**
```json
{ "success": true }
```

**Chybove odpovedi:**
- `401` — chybejici nebo neplatny API klic
- `400` — chybejici povinne pole
