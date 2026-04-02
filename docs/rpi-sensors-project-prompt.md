# Projekt: Sběr dat z čidel na Raspberry Pi Zero 2W

## Kontext

Na Raspberry Pi Zero 2W již běží sběr dat z meteostanice ABB free@home WS-1.
Tento nový projekt je **samostatný** a nesmí narušit stávající funkci.

### Stávající systém na RPi (NESMÍ SE MĚNIT)

- **Skript:** `/home/pi/freeathome-meteo/rpi/collect.mjs` (Node.js, ESM)
- **Cron:** `*/10 * * * *` — každých 10 minut (ve skutečnosti běží každých 60 sekund, cron bude aktualizován)
- **Co dělá:** Čte 4 datapointy z ABB SysAP přes lokální HTTPS API (Basic Auth):
  - `ch0000/odp0001` — jas (lux)
  - `ch0001/odp0000` — déšť (0/1)
  - `ch0002/odp0001` — teplota (°C)
  - `ch0003/odp0001` — vítr (m/s)
- **SysAP adresa:** `192.168.68.55` (lokální síť)
- **Zapisuje do:** Turso DB (SQLite v cloudu) přes HTTP Pipeline API
- **Tabulky:** `measurements`, `hourly_aggregates`, `daily_aggregates`
- **Env soubor:** `/home/pi/freeathome-meteo/rpi/.env`
- **Log:** `/home/pi/freeathome-meteo/rpi/collect.log`
- **DŮLEŽITÉ:** `NODE_TLS_REJECT_UNAUTHORIZED=0` je nutné pro SysAP (self-signed cert)

### Pravidla soužití

- Nový projekt musí mít **vlastní složku**, vlastní `.env`, vlastní cron záznam
- Nesmí měnit soubory v `/home/pi/freeathome-meteo/rpi/`
- Nesmí zasahovat do GPIO pinů používaných SysAP komunikací (žádné — SysAP je přes WiFi)
- RPi Zero 2W má 4 jádra (ARM Cortex-A53) a 512 MB RAM — oba scripty poběží bez problémů
- Doporučená složka: `/home/pi/sensors/`

---

## Požadavky na nový projekt

### 1. Teplotní čidla (6–8 kusů)

**Účel:** Monitorování technologie v technické místnosti (bojler, čerpadlo, potrubí, zásobník TUV, apod.)

**Doporučená technologie:** 1-Wire (DS18B20)
- Vodotěsná varianta v nerezovém pouzdru (6mm průměr, kabel 1–3m)
- Připojit na **GPIO 4** (výchozí 1-Wire pin na RPi)
- Všechna čidla na jedné sběrnici — stačí 1 pull-up rezistor 4.7kΩ
- Každé čidlo má unikátní 64-bit adresu — automatická identifikace
- Přesnost ±0.5°C, rozsah -55°C až +125°C, rozlišení 12 bit
- Napájení 3.3V z RPi

**Potřebný hardware:**
- 8× DS18B20 vodotěsné čidlo s kabelem (cca 50–80 Kč/ks)
- 1× pull-up rezistor 4.7kΩ (mezi DATA a VCC)
- Případně: 1× DS18B20 adaptér/HAT pro RPi (zjednodušení zapojení)

**Software:**
- Aktivovat 1-Wire v `/boot/config.txt`: `dtoverlay=w1-gpio,gpiopin=4`
- Čidla se objeví v `/sys/bus/w1/devices/28-xxxxxxxxxxxx/temperature`
- Čtení: přečíst soubor, vydělit 1000 → teplota v °C

### 2. Plováková čidla — hladina nádrže na dešťovku (4 kusy)

**Účel:** Určit výšku hladiny v nádrži. 4 plovákové spínače na různých výškách → 5 úrovní (0%, 25%, 50%, 75%, 100%).

**Doporučená technologie:** Plovákový spínač (float switch)
- Typ: vertikální plovákový spínač, normálně otevřený (NO)
- Připojit na **GPIO 17, 27, 22, 23** (libovolné volné GPIO)
- Každý spínač: jeden vodič na GPIO, druhý na GND
- Aktivovat interní pull-up rezistor v softwaru

**Potřebný hardware:**
- 4× plovákový spínač (vertikální, kabel min. 50cm, IP68) — cca 40–80 Kč/ks
- Kabeláž pro vedení z nádrže do technické místnosti
- Případně: kabelová průchodka pro vstup do nádrže

**Software:**
- Knihovna `onoff` nebo přímé čtení `/sys/class/gpio/`
- GPIO read → HIGH = spínač rozepnutý (pod hladinou), LOW = sepnutý (nad hladinou)
- Logika: počet sepnutých spínačů × 25% = úroveň hladiny

### 3. Čidlo vlhkosti vzduchu

**Účel:** Doplnění dat k meteostanici — relativní vlhkost venkovního vzduchu.

**Doporučená technologie:** I2C čidlo BME280 nebo SHT31
- **BME280** — teplota + vlhkost + tlak (3v1) → pokryje i požadavek na barometrický tlak!
- Připojit na I2C sběrnici: **SDA = GPIO 2, SCL = GPIO 3**
- Napájení 3.3V z RPi
- Přesnost vlhkost: ±3% RH, teplota: ±1°C, tlak: ±1 hPa

**Potřebný hardware:**
- 1× BME280 breakout modul (cca 80–150 Kč)
- Případně venkovní kryt s ventilací (radiation shield) pro přesné venkovní měření
- 4× propojovací kabel (dupont F-F)

**Software:**
- Aktivovat I2C v `/boot/config.txt`: `dtparam=i2c_arm=on`
- Knihovna: `bme280` (npm) nebo přímé čtení přes `i2c-bus`
- Adresa: 0x76 nebo 0x77

### 4. Barometrický tlak

**Řešení:** Již pokryto čidlem **BME280** z bodu 3. Žádný další hardware není potřeba.

### 5. Měření výkonu fotovoltaiky (ohřev vody)

**Účel:** Měřit aktuální výkon FV panelů → kolik energie jde do ohřevu.

**Problém:** Měnič nemá datový výstup. Je potřeba měřit přímo.

**Doporučené řešení A — Proudový transformátor (neinvazivní, bezpečné):**
- **SCT-013-030** — klešťový proudový transformátor, 0–30A → 0–1V výstup
- Nasadit na vodič mezi FV panely a měnič (nemusí se rozpojovat!)
- Pro měření napětí: **ZMPT101B** napěťový transformátor (galvanicky oddělený)
- Výkon = U × I

**Doporučené řešení B — Hotový měřič (jednodušší, přesnější):**
- **PZEM-004T** modul — měří napětí, proud, výkon, energii, frekvenci, účiník
- Komunikace přes UART (serial) → přímo na RPi GPIO (TX/RX)
- Rozsah: 0–100A (s proudovým transformátorem v balení), 80–260V AC
- Výstup: hotové hodnoty výkonu ve wattech

**Doporučuji řešení B (PZEM-004T)** — je přesnější, bezpečnější a jednodušší na implementaci.

**Potřebný hardware:**
- 1× PZEM-004T v2 modul s CT cívkou (cca 150–250 Kč)
- Propojovací kabely na UART (GPIO 14 TX, GPIO 15 RX)
- **POZOR:** PZEM pracuje s 230V AC — instalaci musí provést elektrikář!

**Software:**
- Knihovna: `pzem004t` nebo vlastní UART komunikace přes `serialport`
- Modbus RTU protokol
- Čtení: napětí (V), proud (A), výkon (W), energie (kWh)

---

## Shrnutí hardware

| Položka | Ks | GPIO/Rozhraní | Cena odhad |
|---|---|---|---|
| DS18B20 vodotěsné | 8 | 1-Wire (GPIO 4) | 400–640 Kč |
| Rezistor 4.7kΩ | 1 | — | 2 Kč |
| Plovákový spínač IP68 | 4 | GPIO 17, 27, 22, 23 | 160–320 Kč |
| BME280 modul | 1 | I2C (GPIO 2, 3) | 80–150 Kč |
| PZEM-004T v2 + CT | 1 | UART (GPIO 14, 15) | 150–250 Kč |
| Propojovací kabely, breadboard | — | — | 100 Kč |
| **Celkem** | | | **~900–1500 Kč** |

### Obsazení GPIO pinů

```
GPIO 2  — I2C SDA (BME280)
GPIO 3  — I2C SCL (BME280)
GPIO 4  — 1-Wire (DS18B20 × 8)
GPIO 14 — UART TX (PZEM-004T)
GPIO 15 — UART RX (PZEM-004T)
GPIO 17 — Plovák 1 (0%)
GPIO 22 — Plovák 2 (25%)
GPIO 23 — Plovák 3 (50%)
GPIO 27 — Plovák 4 (75%)
```

---

## Architektura softwaru

### Struktura projektu

```
/home/pi/sensors/
  collect.mjs          — hlavní sběrný skript
  package.json         — závislosti (dotenv, i2c-bus, onoff, serialport)
  .env                 — konfigurace (DB credentials, GPIO piny, intervaly)
  install.sh           — instalační skript
  collect.log          — log
  README.md            — dokumentace
```

### Databáze

**Varianta A — Samostatná Turso DB** (doporučeno pro oddělení):
- Nová databáze na Turso (free tier umožňuje více DB)
- Vlastní tabulky bez rizika kolize s meteo projektem

**Varianta B — Stejná Turso DB, nové tabulky:**
- Výhoda: vše na jednom místě
- Riziko: sdílený rate limit

**Navržené tabulky:**

```sql
-- Teplotní čidla
CREATE TABLE sensor_temperatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
  sensor_id TEXT NOT NULL,        -- '28-xxxxxxxxxxxx' (1-Wire adresa)
  sensor_name TEXT,               -- 'Bojler', 'TUV vstup', apod.
  temperature REAL NOT NULL
);

-- Hladina nádrže
CREATE TABLE tank_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
  level_percent INTEGER NOT NULL, -- 0, 25, 50, 75, 100
  switch_1 INTEGER,               -- 0/1
  switch_2 INTEGER,
  switch_3 INTEGER,
  switch_4 INTEGER
);

-- Venkovní prostředí (BME280)
CREATE TABLE environment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
  humidity REAL,                  -- % RH
  pressure REAL,                  -- hPa
  temperature REAL                -- °C (kontrolní)
);

-- Fotovoltaika
CREATE TABLE solar_power (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
  voltage REAL,                   -- V
  current REAL,                   -- A
  power REAL,                     -- W
  energy REAL                     -- kWh (kumulativní)
);
```

### Sběrný cyklus

```
Každých 60 sekund:
  1. Přečíst všechna DS18B20 čidla (1-Wire) → sensor_temperatures
  2. Přečíst plovákové spínače (GPIO) → tank_levels
  3. Přečíst BME280 (I2C) → environment
  4. Přečíst PZEM-004T (UART) → solar_power
  5. Odeslat vše do Turso DB jedním pipeline requestem
```

### Cron

```bash
# Stávající meteo sběr (NEMĚNIT)
* * * * * NODE_TLS_REJECT_UNAUTHORIZED=0 /usr/bin/node /home/pi/freeathome-meteo/rpi/collect.mjs >> /home/pi/freeathome-meteo/rpi/collect.log 2>&1

# Nový sběr čidel
* * * * * /usr/bin/node /home/pi/sensors/collect.mjs >> /home/pi/sensors/collect.log 2>&1
```

---

## Postup implementace

1. **Hardware:** Objednat komponenty, zapojit na breadboard, otestovat jednotlivě
2. **Aktivovat rozhraní na RPi:**
   ```bash
   sudo raspi-config
   # → Interface Options → I2C → Enable
   # → Interface Options → Serial Port → Login shell: No, Serial hardware: Yes
   # → Interface Options → 1-Wire → Enable
   sudo reboot
   ```
3. **Vytvořit projekt:** `/home/pi/sensors/`, `npm init`, nainstalovat závislosti
4. **Implementovat čtení** jednotlivých senzorů a otestovat
5. **Vytvořit Turso DB** a migraci tabulek
6. **Sběrný skript** — spojit vše do jednoho cyklu
7. **Cron** — nastavit automatický sběr
8. **Volitelně:** webový dashboard pro zobrazení dat (rozšíření meteopacetluky.cz nebo nový web)

---

## Poznámky

- RPi Zero 2W nemá standardní 40-pin header zapájený — může být potřeba zapájet nebo koupit verzi s headerem (Zero 2 WH)
- BME280 pro venkovní měření potřebuje radiation shield (stínění před přímým sluncem a deštěm)
- PZEM-004T pracuje s 230V — zapojení do silového obvodu musí provést elektrikář
- Plovákové spínače v nádrži na dešťovku musí být IP68 a odolné vůči usazeninám
- Pro dlouhé kabelové vedení DS18B20 (>5m) může být potřeba silnější pull-up (2.2kΩ) nebo aktivní pull-up modul
