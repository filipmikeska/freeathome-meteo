# Raspberry Pi — runbook pro nasazení a opravu sběru dat

Kompletní postup nasazení skriptu `collect.mjs` na Raspberry Pi Zero 2W pro meteopacetluky.cz. Platí pro novou instalaci i pro obnovu nefunkčního RPi.

## Klíčové parametry

| Parametr | Hodnota |
|----------|---------|
| Hardware | Raspberry Pi Zero 2W |
| OS | Raspberry Pi OS Lite (64-bit, Bookworm) |
| Uživatel na RPi | `raspi` |
| Hostname | `raspberrypi` (původně `RasPi` — obojí funguje) |
| Wi-Fi SSID | `Holly_100` (2.4 GHz — Zero 2W 5 GHz neumí!) |
| **SysAP IP** | **`192.168.68.56`** (POZOR — ne `.55`, byla chyba v dřívější dokumentaci) |
| SysAP účet | `installer` |
| Device ID | `7EB10000329B` |
| Frekvence sběru | 1× za minutu přes cron |

---

## 1. Rychlé příkazy (když RPi funguje)

```powershell
# SSH — vše bez hesla díky klíči
ssh raspi@192.168.68.58

# Live log
ssh raspi@192.168.68.58 "tail -f ~/meteo/logs/collect.log"

# Ruční spuštění sběru (diagnostika)
ssh raspi@192.168.68.58 "cd ~/meteo/rpi && NODE_TLS_REJECT_UNAUTHORIZED=0 node collect.mjs"

# Cron status
ssh raspi@192.168.68.58 "crontab -l && systemctl is-active cron"

# Aktualizace kódu po změně v GitHubu
ssh raspi@192.168.68.58 "cd ~/meteo && git pull && cd rpi && npm install"
```

---

## 2. Diagnostika nefunkčního RPi

### 2.1 Pi je dosažitelný?

```powershell
ping 192.168.68.58            # Aktuální IP (podívej se v routeru)
ping RasPi.local              # Původní hostname
ping raspberrypi.local        # Nový hostname
```

Pokud nic neodpovídá → RPi není na síti:
- Zkontroluj zelenou LED (Zero 2W má JEN jednu zelenou, ne červenou!)
- Router → seznam DHCP klientů (hledej MAC `B8:27:EB`, `DC:A6:32`, `D8:3A:DD`)

### 2.2 Tabulka příznaků

| Příznak | Pravděpodobná příčina | Fix |
|---------|----------------------|-----|
| Žádná LED nesvítí | Nefunkční napájení | Zkontroluj kabel, adaptér, zásuvku |
| Zelená LED bliká při bootu, pak trvale svítí | Systém naběhl (normální) | Pokračuj na test sítě |
| Ping nereaguje, v routeru není | Wi-Fi se nespojila | Oprav přes bootfs (viz 3.1) |
| Ping OK, ping na SysAP OK, `fetch failed` | Self-signed cert | `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| Ping SysAP OK, ale `Connection refused :443` | Špatná IP SysAPu | Zkontroluj aktuální IP SysAP |
| `Host key verification failed` při SSH | Stará instalace, nové klíče | `ssh-keygen -R <IP>` |
| `fetch failed` ale síť OK | Špatné heslo SysAP | Zkontroluj `.env` |
| Cron v `crontab -l`, ale log prázdný | Cron služba vypnutá | `sudo systemctl start cron` |

---

## 3. Obnova přes SD kartu (když Wi-Fi nefunguje)

### 3.1 Editace bootfs z Windows

1. **Vypnout RPi** (odpoj napájení)
2. **Vyndat SD kartu** → vložit do čtečky v PC
3. **Windows neukáže bootfs automaticky** — přes Správu disků (`Win+X` → Správa disků) přiřaď písmeno jednotky (např. `E:`) FAT32 partici 256 MB. **NEDOTÝKEJ SE druhé partice — ext4 rootfs**
4. Uprav tyto soubory:

**`E:\network-config`** — Wi-Fi v plain textu (ne PSK hash):
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      dhcp6: true
      optional: true
  wifis:
    wlan0:
      dhcp4: true
      regulatory-domain: "CZ"
      access-points:
        "Holly_100":
          password: "123456654321"
      optional: true
```

**`E:\meta-data`** — unikátní instance-id (změň datum na dnešek):
```
instance-id: rpi-imager-reset-YYYYMMDD
```

**`E:\cmdline.txt`** — stejné instance-id jako v meta-data (část `i=...`):
```
console=serial0,115200 console=tty1 root=PARTUUID=2828e3c5-02 rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles ds=nocloud;i=rpi-imager-reset-YYYYMMDD cfg80211.ieee80211_regdom=CZ
```

**Důležité:** `instance-id` v `meta-data` a `i=` parametr v `cmdline.txt` musí být identické. Cloud-init se pak pustí jako při prvním bootu a re-aplikuje Wi-Fi konfiguraci.

5. Bezpečně vysunout SD kartu z PC
6. Vložit do RPi, zapnout
7. Počkat 2–3 minuty (první boot s cloud-initem je delší)
8. Ping

### 3.2 Pozor — cloud-init re-init smaže domovský adresář!

Pokud změníš `instance-id`, cloud-init smaže `/home/raspi/` a vytvoří ho znovu. Projekt `~/meteo` **zmizí**. Projdi krok 4 (Reinstalace projektu).

---

## 4. Kompletní nová instalace (reflash)

### 4.1 Flashing — Raspberry Pi Imager

1. Stáhni Raspberry Pi Imager: https://www.raspberrypi.com/software/
2. Vlož SD kartu do PC
3. Spusť Imager:
   - **Choose device**: Raspberry Pi Zero 2 W
   - **Choose OS**: Raspberry Pi OS (other) → Raspberry Pi OS Lite (64-bit)
   - **Choose storage**: SD karta
   - **Next** → **EDIT SETTINGS**

**Záložka GENERAL:**
- ☑ Set hostname: `raspberrypi`
- ☑ Set username and password: `raspi` / `<zvolit silné heslo>`
- ☑ Configure wireless LAN: SSID `Holly_100`, heslo `123456654321`, country `CZ`
- ☑ Set locale settings: Europe/Prague, keyboard `cz`

**Záložka SERVICES:**
- ☑ Enable SSH (password authentication)

**Záložka OPTIONS:**
- Default (vše zaškrtnuté)

4. **SAVE** → Yes → Yes (erase warning) → počkat na dokončení (5–10 min)
5. Vysunout SD kartu, vložit do RPi, zapnout

### 4.2 První SSH spojení

```powershell
# Odstraň staré host keys
ssh-keygen -R 192.168.68.58
ssh-keygen -R raspberrypi.local
ssh-keygen -R RasPi.local

# Připoj se (zadej heslo, které jsi nastavil v Imageru)
ssh raspi@raspberrypi.local
# nebo ssh raspi@<IP z routeru>
# → yes na otázku o fingerprintu
```

### 4.3 SSH klíč — eliminace hesel

**Z Windows PowerShell (jednorázově):**

```powershell
# Vygenerovat klíč (pokud ještě neexistuje)
if (-not (Test-Path "$env:USERPROFILE\.ssh\id_ed25519.pub")) {
  ssh-keygen -t ed25519 -N '""' -f "$env:USERPROFILE\.ssh\id_ed25519" -C "produ@meteopacetluky"
}

# Přenést public key na Pi (zeptá se na heslo NAPOSLEDY)
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh raspi@<IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### 4.4 Passwordless sudo

```powershell
ssh -t raspi@<IP> "echo 'raspi ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/010_raspi-nopasswd && sudo chmod 440 /etc/sudoers.d/010_raspi-nopasswd"
```
(zeptá se na heslo k `raspi` naposledy)

### 4.5 Instalace projektu (vše přes SSH, bez nutnosti hesla)

```powershell
ssh raspi@<IP> "sudo apt-get update -qq && sudo apt-get install -y nodejs npm git"
ssh raspi@<IP> "git clone https://github.com/filipmikeska/freeathome-meteo.git ~/meteo && cd ~/meteo/rpi && npm install"
```

### 4.6 Vytvoření `.env`

```powershell
ssh raspi@<IP> @'
cat > ~/meteo/rpi/.env << ''EOF''
ABB_DEVICE_ID=7EB10000329B
ABB_LOCAL_HOST=192.168.68.56
ABB_LOCAL_USER=installer
ABB_LOCAL_PASSWORD=156423

TURSO_DATABASE_URL=libsql://freeathome-meteo-filipmikeska.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=<token z Vercel env vars nebo .env.local na PC>
EOF
chmod 600 ~/meteo/rpi/.env
'@
```

### 4.7 Ověření sběru

```powershell
ssh raspi@<IP> "cd ~/meteo/rpi && NODE_TLS_REJECT_UNAUTHORIZED=0 node collect.mjs"
```

Očekávaný výstup:
```
[YYYY-MM-DD HH:MM:SS] Čtu data z meteostanice...
[YYYY-MM-DD HH:MM:SS]   Teplota:  X.XX °C
[YYYY-MM-DD HH:MM:SS]   Jas:      XXXXX lux
[YYYY-MM-DD HH:MM:SS]   Vítr:     X m/s
[YYYY-MM-DD HH:MM:SS]   Déšť:     NE/ANO
[YYYY-MM-DD HH:MM:SS] Ukládám do databáze...
[YYYY-MM-DD HH:MM:SS] Hotovo!
```

### 4.8 Cron — spouštění každou minutu

```powershell
ssh raspi@<IP> "mkdir -p ~/meteo/logs && echo '* * * * * cd /home/raspi/meteo/rpi && NODE_TLS_REJECT_UNAUTHORIZED=0 /usr/bin/node collect.mjs >> /home/raspi/meteo/logs/collect.log 2>&1' | crontab -"
```

Ověření po 70 sekundách:
```powershell
ssh raspi@<IP> "tail -20 ~/meteo/logs/collect.log"
```

### 4.9 Finální kontrola na webu

Otevři https://meteopacetluky.cz/api/current — `updatedAt` by měl být v posledních 2 minutách.

---

## 5. Gotchas — pastičky z reálného života

1. **Pi Zero 2W nemá červenou LED** — jen zelenou. Pokud někdo říká „červená nesvítí", je to v pořádku.
2. **Pi Zero 2W neumí 5 GHz Wi-Fi.** Pokud je na routeru jen 5 GHz, nepřipojí se.
3. **SysAP má self-signed certifikát** — skript musí běžet s `NODE_TLS_REJECT_UNAUTHORIZED=0`.
4. **IP SysAPu se může změnit** — po restartu routeru může dostat jinou. Správná IP je ověřitelná v routeru nebo `ping 192.168.68.55` / `56` / `57` aby se zjistilo, která odpovídá.
5. **Cloud-init běží jen při prvním bootu.** Změny v `bootfs/network-config` se aplikují, jen pokud změníš `instance-id` v `meta-data` a `cmdline.txt` (musí se shodovat!).
6. **Změna `instance-id` smaže home adresář.** Projekt musí být přeinstalován.
7. **PSK hash v `network-config` = SSID + heslo** — pokud se jedno změní, hash neodpovídá. Použij plain-text heslo.
8. **SSH host keys se mění při každé reinstalaci.** Vždy `ssh-keygen -R <IP>` před prvním spojením na reinstalované RPi.
9. **`ssh` bez `-t` neumožní interaktivní `sudo` prompt.** Pro první `sudo` vždy `ssh -t`.
10. **Hostname může být `RasPi` nebo `raspberrypi`** dle způsobu instalace (Imager vs. custom cloud-init).
11. **Windows nevidí ext4** — SD karta má 2 partice, jen FAT32 (bootfs) je z Windows editovatelná.
12. **`type` v PowerShellu má jiné chování** — používej `Get-Content` pro čtení souborů.

---

## 6. Credentials — kde je hledat

| Credential | Umístění |
|-----------|----------|
| `ABB_LOCAL_PASSWORD` | Vercel env vars / SysAP admin web |
| `TURSO_AUTH_TOKEN` | `.env.local` na PC, Vercel env vars |
| `TURSO_DATABASE_URL` | `.env.local` na PC (veřejné URL) |
| Wi-Fi heslo | Uložené v routeru / chatu |
| SSH heslo k `raspi` | Zvoleno při instalaci přes Imager |

## 7. Odkazy

- **Repo**: https://github.com/filipmikeska/freeathome-meteo
- **Produkce**: https://meteopacetluky.cz
- **Vercel**: https://vercel.com/filipmikeskas-projects/freeathome-meteo
- **Turso**: https://turso.tech (accountname filipmikeska)
