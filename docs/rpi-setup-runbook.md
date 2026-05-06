# Raspberry Pi — runbook pro nasazení a opravu sběru dat

Kompletní postup nasazení daemonu `collect.mjs` na Raspberry Pi Zero 2W pro meteopacetluky.cz, optimalizovaný pro **maximální životnost SD karty**.

## Klíčové parametry

| Parametr | Hodnota |
|----------|---------|
| Hardware | Raspberry Pi Zero 2W |
| OS | Raspberry Pi OS Lite (64-bit, Bookworm) |
| Uživatel | `raspi` |
| Hostname | `raspberrypi` |
| Wi-Fi SSID | `Holly_100` (2.4 GHz — Zero 2W 5 GHz neumí) |
| **SysAP IP** | **`192.168.68.56`** |
| SysAP účet | `installer` |
| Device ID | `7EB10000329B` |
| Frekvence sběru | 1× za minutu (interní setInterval) |
| Architektura | systemd daemon (NE cron) |
| Logy | journald (volatile, RAM) + `/dev/shm/meteo.log` (RAM) |

---

## Architektura — proč už ne cron

**Stará verze** (cron každou minutu) zničila SD kartu za 2 měsíce kvůli:

| Zdroj zápisů | Dopad |
|---|---|
| PAM session při každém cronu | `auth.log`, `syslog` 1 440×/den |
| systemd-journald persistent | `/var/log/journal/` mnoho MB/den |
| Cron logy | další zápisy do logu |
| collect.log na disku | 1 440 zápisů/den |
| Filesystem journal (commit=5s) | nejhorší — tisíce metadata zápisů |

**Nová verze** = jeden dlouhoběžící Node proces:

- žádný cron → 0 PAM zápisů
- journald v `Storage=volatile` (RAM) → 0 systémových log zápisů
- collect.mjs loguje jen chyby do `/dev/shm` (RAM)
- ext4 mountnutý s `noatime,commit=600` → 120× méně metadata zápisů
- vypnut swap, rsyslog, bluetooth, atd.

**Odhadovaný výsledek**: SD karta vydrží **5+ let** místo 2 měsíců.

---

## 1. Nová instalace na čerstvý RPi

### 1.1 Flash SD karty přes Pi Imager

1. Stáhni Raspberry Pi Imager: https://www.raspberrypi.com/software/
2. Vlož SD kartu, spusť Imager
3. Nastav:
   - **Device**: Raspberry Pi Zero 2 W
   - **OS**: Raspberry Pi OS Lite (64-bit, Bookworm)
   - **Storage**: SD karta
4. **EDIT SETTINGS**:
   - Hostname: `raspberrypi`
   - User: `raspi` / `<silné heslo>`
   - Wi-Fi: `Holly_100` / `123456654321` / country `CZ`
   - Locale: `Europe/Prague`, keyboard `cz`
   - SSH: enabled, password authentication
5. **SAVE → YES** → flash (5–10 min)
6. Vlož kartu do RPi, zapni

### 1.2 První přihlášení a SSH klíč

Z PowerShellu:

```powershell
# Vyčisti staré SSH host keys
ssh-keygen -R 192.168.68.58
ssh-keygen -R raspberrypi.local

# Připoj se (zadej heslo z Imageru, yes na fingerprint)
ssh raspi@raspberrypi.local

# Pokud nefunguje, najdi IP v routeru a použij ji přímo
```

Z dalšího okna PowerShellu (na PC) zkopíruj SSH klíč:

```powershell
if (-not (Test-Path "$env:USERPROFILE\.ssh\id_ed25519.pub")) {
  ssh-keygen -t ed25519 -N '""' -f "$env:USERPROFILE\.ssh\id_ed25519" -C "produ@meteopacetluky"
}
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh raspi@raspberrypi.local "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Passwordless sudo (jednorázově):

```powershell
ssh -t raspi@raspberrypi.local "echo 'raspi ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/010_raspi-nopasswd && sudo chmod 440 /etc/sudoers.d/010_raspi-nopasswd"
```

### 1.3 Instalace přes install.sh

Na RPi:

```bash
git clone https://github.com/filipmikeska/freeathome-meteo.git ~/meteo
cd ~/meteo/rpi

# Vytvoř .env z šablony, doplň hesla
cp .env.example .env
nano .env
# Hodnoty:
#   ABB_LOCAL_PASSWORD=156423
#   TURSO_DATABASE_URL=libsql://...   (z .env.local na PC)
#   TURSO_AUTH_TOKEN=eyJ...           (z .env.local na PC)

# Spusť automatickou instalaci se všemi optimalizacemi
bash install.sh
```

`install.sh` automaticky:

1. Nainstaluje Node.js, npm, git
2. Naklonuje (nebo pullne) repozitář
3. Nainstaluje npm závislosti
4. Otestuje sběr (oneshot mode)
5. Nainstaluje **systemd službu** `meteo-collect.service`
6. Odstraní starý cron job (pokud existuje)
7. Vypne swap
8. Nastaví journald do `Storage=volatile` (RAM)
9. Odstraní rsyslog
10. Nainstaluje log2ram (volitelně)
11. Přidá `noatime,commit=600` do `/etc/fstab`
12. Vypne bluetooth, triggerhappy, avahi, ModemManager
13. Vypne automatické apt updaty
14. Spustí službu

Po dokončení **restartuj** pro plnou aktivaci optimalizací:

```bash
sudo reboot
```

### 1.4 Ověření

```bash
sudo systemctl status meteo-collect       # běží?
sudo journalctl -u meteo-collect -f       # live logy
tail -f /dev/shm/meteo.log                # debug log v RAM
```

Web https://meteopacetluky.cz/api/current → `updatedAt` v posledních 2 minutách.

---

## 2. Update kódu po změně v GitHubu

```bash
ssh raspi@raspberrypi.local "cd ~/meteo && git pull && sudo systemctl restart meteo-collect"
```

---

## 3. Diagnostika nefunkčního sběru

### 3.1 Stav služby

```bash
sudo systemctl status meteo-collect
sudo journalctl -u meteo-collect -n 100 --no-pager
```

### 3.2 Ruční test

```bash
cd ~/meteo/rpi
ONESHOT=1 DEBUG=1 node collect.mjs
```

### 3.3 Síťová diagnostika

```bash
ping -c 2 192.168.68.56                                    # SysAP dosažitelný?
nc -zv -w 5 192.168.68.56 443                              # Port HTTPS otevřený?
curl -k -s -o /dev/null -w 'HTTP: %{http_code}\n' --max-time 10 https://192.168.68.56/
```

### 3.4 Tabulka chyb

| Příznak | Příčina | Fix |
|---------|---------|-----|
| `meteo-collect failed` v journalu | Skript spadl | `sudo journalctl -u meteo-collect -n 50` |
| `fetch failed` | SysAP nedosažitelný | Ověř IP (`.55` vs `.56`), ping, port 443 |
| `SysAP API 401` | Špatné heslo SysAP | Oprav `.env` → restart služby |
| `Turso API 401` | Vypršený token | Regeneruj na turso.tech, oprav `.env` |
| Pi nereaguje na ping | Wi-Fi spadla | Boot fix přes SD kartu (viz 4) |
| Služba se restartuje v cyklu | StartLimit | `sudo systemctl reset-failed meteo-collect && sudo systemctl restart meteo-collect` |

---

## 4. Obnova přes SD kartu (Wi-Fi nefunguje)

Postup zůstává stejný jako v původní verzi runbooku — viz git historie.
Klíčové: edituj `network-config` v bootfs s plain-textovým heslem,
změň `instance-id` v `meta-data` i v `cmdline.txt` (musí být stejné),
**varování:** to způsobí re-init cloud-initu a smazání `~/raspi`.

Po re-initu prostě znovu spusť `install.sh` (viz sekce 1).

---

## 5. Doporučení — nová SD karta

Stará karta vydržela 2 měsíce, protože byla pravděpodobně levný consumer model
a navíc systém zapisoval ~10 000×/den. Po našich optimalizacích bude zápisů
~50–100/den, ale stejně vyber kartu s vyšší výdrží:

| Třída | Karta | Cena | TBW |
|-------|-------|------|-----|
| **High Endurance** | SanDisk High Endurance / Samsung PRO Endurance 64 GB | 250–400 Kč | ~32 TB |
| **Industrial** ⭐ | SanDisk Industrial / KIOXIA EXCERIA / Transcend Industrial 32 GB | 600–900 Kč | ~150 TB (pSLC) |

**Doporučení**: Industrial 32 GB. Pro náš use-case (5 GB systém + minimální zápisy) je velikost dostatečná a TBW dramaticky vyšší.

---

## 6. Architektonické soubory

| Soubor | Účel |
|--------|------|
| `rpi/collect.mjs` | Daemon — interní smyčka, signal handling, error rate-limit |
| `rpi/meteo-collect.service` | systemd unit (Restart=always, MemoryMax=128M) |
| `rpi/install.sh` | Idempotentní instalátor pro celé RPi |
| `rpi/.env.example` | Šablona konfigurace |

---

## 7. Gotchas

1. **Pi Zero 2W má JEN 1 zelenou LED** (žádná červená)
2. **Pi Zero 2W neumí 5 GHz Wi-Fi**
3. **SysAP self-signed cert** → `NODE_TLS_REJECT_UNAUTHORIZED=0` je nyní zapečené v `collect.mjs`
4. **SysAP IP `.56`**, ne `.55` (chyba ve staré dokumentaci)
5. **Cloud-init re-init smaže home** — pokud měníš `instance-id`, počítej s reinstalací projektu
6. **Změna SSID/hesla = neplatný PSK hash** v cloud-init network-config → použij plain text
7. **systemd `Restart=always`** automaticky restartuje při výpadku sítě nebo SysAPu
8. **Logy v RAM zmizí při rebootu** — pro perzistenci ulož do souboru explicitně přes journalctl
