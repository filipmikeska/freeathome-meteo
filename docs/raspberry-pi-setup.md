# Raspberry Pi — Sběr dat z meteostanice

Podrobný návod na nastavení Raspberry Pi Zero 2 WH jako 24/7 sběrače dat
z ABB free@home meteostanice.

## Co budete potřebovat

| Položka | Cena (cca) |
|---------|-----------|
| Raspberry Pi Zero 2 WH | ~450 Kč |
| MicroSD karta (16 GB+) | ~100 Kč |
| USB-C napájecí kabel + adaptér (5V/2.5A) | ~150 Kč |
| **Celkem** | **~700 Kč** |

> RPi Zero 2 WH má vestavěné WiFi a GPIO header — nepotřebujete nic dalšího.

---

## 1. Instalace Raspberry Pi OS

### 1.1 Stáhněte Raspberry Pi Imager

Stáhněte z [raspberrypi.com/software](https://www.raspberrypi.com/software/) a nainstalujte na PC.

### 1.2 Zapište OS na SD kartu

1. Vložte microSD kartu do PC
2. Spusťte **Raspberry Pi Imager**
3. Vyberte:
   - **Zařízení**: Raspberry Pi Zero 2 W
   - **Operační systém**: Raspberry Pi OS Lite (64-bit) — bez desktopu, stačí příkazový řádek
   - **Úložiště**: vaše SD karta
4. Klikněte na **⚙ ozubené kolečko** (nebo Ctrl+Shift+X) a nastavte:

#### Nastavení v Imager:

| Pole | Hodnota |
|------|---------|
| Hostname | `meteo-rpi` |
| Povolit SSH | ✓ Ano, s heslem |
| Uživatelské jméno | `pi` |
| Heslo | (vaše bezpečné heslo) |
| WiFi SSID | (název vaší WiFi sítě) |
| WiFi heslo | (heslo k WiFi) |
| WiFi země | CZ |
| Časové pásmo | Europe/Prague |
| Rozložení klávesnice | cz |

5. Klikněte **Zapsat** a počkejte na dokončení

### 1.3 První spuštění

1. Vložte SD kartu do RPi
2. Připojte napájení (USB-C)
3. Počkejte 2–3 minuty na boot a připojení k WiFi

---

## 2. Připojení přes SSH

### Zjištění IP adresy

Podívejte se do administrace routeru (TP-Link Deco / Archer), nebo zkuste:

```bash
# Z PC ve stejné síti:
ping meteo-rpi.local
```

### Připojení

```bash
ssh pi@meteo-rpi.local
# nebo
ssh pi@192.168.68.XXX
```

Zadejte heslo, které jste nastavili v Imager.

> **Tip pro Windows:** Použijte Windows Terminal, PowerShell nebo [PuTTY](https://www.putty.org/).

---

## 3. Aktualizace systému

```bash
sudo apt update && sudo apt upgrade -y
```

Trvá to na RPi Zero cca 5–10 minut.

---

## 4. Instalace Node.js

Raspberry Pi Zero 2 WH má ARM64 procesor. Nejjednodušší instalace:

```bash
# Přidejte NodeSource repozitář
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Nainstalujte Node.js
sudo apt-get install -y nodejs

# Ověřte instalaci
node -v    # mělo by ukázat v20.x.x
npm -v     # mělo by ukázat 10.x.x
```

---

## 5. Nahrání skriptu na RPi

### Varianta A: Přes Git (doporučeno)

```bash
# Na RPi:
sudo apt install -y git
cd ~
git clone https://github.com/filipmikeska/freeathome-meteo.git
cd freeathome-meteo/rpi
```

### Varianta B: Přes SCP (kopírování souborů)

```bash
# Z PC (PowerShell/Terminal):
scp -r rpi/ pi@meteo-rpi.local:~/freeathome-meteo-rpi/
```

---

## 6. Konfigurace

### 6.1 Nainstalujte závislosti

```bash
cd ~/freeathome-meteo/rpi    # nebo ~/freeathome-meteo-rpi
npm install --production
```

### 6.2 Vytvořte .env soubor

```bash
cp .env.example .env
nano .env
```

Vyplňte hodnoty:

```env
# ABB free@home SysAP
ABB_DEVICE_ID=7EB10000329B
ABB_LOCAL_HOST=192.168.68.55
ABB_LOCAL_USER=installer
ABB_LOCAL_PASSWORD=VAŠE_HESLO_K_SYSAP

# Turso databáze (zkopírujte z .env.local projektu)
TURSO_DATABASE_URL=libsql://freeathome-meteo-filipmikeska.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=VÁŠ_TURSO_TOKEN
```

> **Kde najdu heslo k SysAP?** Heslo `installer` jste nastavili při prvním nastavení ABB free@home.
> Pokud ho neznáte, otevřete ABB-free@home Next app → Nastavení → Přístup k systému.

Uložte: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 7. Testovací spuštění

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node collect.mjs
```

> `NODE_TLS_REJECT_UNAUTHORIZED=0` je nutné, protože SysAP používá self-signed SSL certifikát.

Měli byste vidět výstup jako:

```
[2026-03-30 14:30:00] Čtu data z meteostanice...
[2026-03-30 14:30:01]   Teplota:  12.5 °C
[2026-03-30 14:30:01]   Jas:      45200 lux
[2026-03-30 14:30:01]   Vítr:     3.2 m/s
[2026-03-30 14:30:01]   Déšť:     NE
[2026-03-30 14:30:01] Ukládám do databáze...
[2026-03-30 14:30:02] Hotovo!
```

### Řešení problémů

| Chyba | Řešení |
|-------|--------|
| `ECONNREFUSED` | RPi není ve stejné síti jako SysAP, nebo špatná IP adresa |
| `SysAP API 401` | Špatné jméno nebo heslo v .env |
| `SysAP API 404` | Špatné DEVICE_ID — ověřte v ABB-free@home Next app |
| `Turso API 401` | Špatný nebo expirovaný TURSO_AUTH_TOKEN |
| `fetch failed` (CERT) | Zapomněli jste `NODE_TLS_REJECT_UNAUTHORIZED=0` |

---

## 8. Nastavení automatického sběru (cron)

Sběr dat každých 10 minut:

```bash
crontab -e
```

Pokud se ptá na editor, vyberte `1` (nano).

Přidejte na konec souboru tento řádek:

```
*/10 * * * * NODE_TLS_REJECT_UNAUTHORIZED=0 /usr/bin/node /home/pi/freeathome-meteo/rpi/collect.mjs >> /home/pi/freeathome-meteo/rpi/collect.log 2>&1
```

> **Upravte cestu**, pokud jste nahrali soubory jinam.

Uložte a zavřete (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Ověření cronu

```bash
# Zobrazit aktivní cron úlohy:
crontab -l

# Sledovat log v reálném čase:
tail -f ~/freeathome-meteo/rpi/collect.log
```

---

## 9. Automatický start po restartu

Cron se spouští automaticky po restartu RPi — žádná další konfigurace není potřeba.

Pro ověření, že RPi přežije restart:

```bash
sudo reboot
```

Po 2–3 minutách se RPi znovu připojí k WiFi a cron začne sbírat data.

---

## 10. Správa logu

Log může časem narůst. Přidejte rotaci — jednou denně o půlnoci smazat starý log:

```bash
crontab -e
```

Přidejte řádek:

```
0 0 * * * echo "" > /home/pi/freeathome-meteo/rpi/collect.log
```

---

## 11. Automatický instalační skript

Místo ručního postupu můžete použít automatický skript:

```bash
cd ~/freeathome-meteo/rpi
bash install.sh
```

Skript:
1. Zkontroluje/nainstaluje Node.js
2. Nainstaluje závislosti (npm)
3. Vytvoří .env z šablony
4. Nabídne testovací spuštění
5. Nastaví cron

---

## 12. Údržba

### Aktualizace skriptu

```bash
cd ~/freeathome-meteo
git pull
cd rpi
npm install --production
```

### Kontrola stavu

```bash
# Poslední záznamy v logu:
tail -20 ~/freeathome-meteo/rpi/collect.log

# Je cron aktivní?
crontab -l

# Kolik místa zabírá SD karta?
df -h

# Teplota procesoru (měla by být pod 70°C):
vcgencmd measure_temp
```

### Statická IP adresa (volitelné)

Aby RPi měl vždy stejnou IP:

```bash
sudo nano /etc/dhcpcd.conf
```

Přidejte na konec:

```
interface wlan0
static ip_address=192.168.68.100/24
static routers=192.168.68.1
static domain_name_servers=192.168.68.1 8.8.8.8
```

> Upravte adresy podle vaší sítě (router Deco X10 typicky 192.168.68.1).

---

## Shrnutí

Po dokončení tohoto návodu máte:

- ✅ RPi Zero 2 WH připojené k WiFi
- ✅ Node.js skript čtoucí data z ABB SysAP každých 10 minut
- ✅ Data automaticky ukládaná do Turso cloudové databáze
- ✅ Webová aplikace na meteopacetluky.cz zobrazující živá data
- ✅ Automatický start po výpadku proudu

**Spotřeba energie:** RPi Zero 2 WH ~ 0.5–1W → cca **10 Kč/měsíc**.
