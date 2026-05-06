#!/bin/bash
# Kompletní instalace sběru dat na Raspberry Pi Zero 2W
# s optimalizacemi pro životnost SD karty.
#
# Použití na čerstvě nainstalovaném Raspberry Pi OS Lite (64-bit Bookworm):
#   git clone https://github.com/filipmikeska/freeathome-meteo.git ~/meteo
#   cd ~/meteo/rpi
#   cp .env.example .env && nano .env   # doplň hesla
#   bash install.sh

set -euo pipefail

# === Barvy ===
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${BLUE}[..]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[ER]${NC} $1"; }

if [ "$EUID" -eq 0 ]; then err "Nespouštěj jako root, použij běžného uživatele s sudo."; exit 1; fi
if ! command -v sudo &>/dev/null; then err "Chybí sudo."; exit 1; fi

REPO_URL="https://github.com/filipmikeska/freeathome-meteo.git"
PROJECT_DIR="$HOME/meteo"
RPI_DIR="$PROJECT_DIR/rpi"
USER_NAME="$(whoami)"

echo "=========================================="
echo " Meteo Pacetluky - instalace na RPi"
echo " Uživatel: $USER_NAME"
echo " Projekt:  $PROJECT_DIR"
echo "=========================================="

# === 1. APT update + balíčky ===
info "Aktualizuji apt cache (jednorázově)..."
sudo apt-get update -qq
ok "apt cache aktualizováno"

info "Instaluji balíčky: nodejs npm git curl..."
sudo apt-get install -y -qq nodejs npm git curl >/dev/null
ok "Balíčky nainstalovány: $(node -v), $(npm -v), $(git --version | cut -d' ' -f3)"

# === 2. Klonování projektu ===
if [ -d "$PROJECT_DIR/.git" ]; then
  info "Projekt už existuje, aktualizuji (git pull)..."
  cd "$PROJECT_DIR" && git pull --ff-only
else
  info "Klonuji repozitář do $PROJECT_DIR..."
  git clone --depth 1 "$REPO_URL" "$PROJECT_DIR"
fi
ok "Projekt v $PROJECT_DIR"

cd "$RPI_DIR"
info "Instaluji npm závislosti..."
npm install --omit=dev --silent
ok "npm závislosti nainstalovány"

# === 3. .env ===
if [ ! -f "$RPI_DIR/.env" ]; then
  warn ".env neexistuje. Vytvářím šablonu z .env.example."
  cp "$RPI_DIR/.env.example" "$RPI_DIR/.env"
  chmod 600 "$RPI_DIR/.env"
  err "EDITUJ $RPI_DIR/.env a doplň hesla, pak spusť install.sh znovu."
  echo "  nano $RPI_DIR/.env"
  exit 1
fi
chmod 600 "$RPI_DIR/.env"
ok ".env existuje a má bezpečná oprávnění"

# Validace .env
if ! grep -q "^ABB_LOCAL_PASSWORD=.\+$" "$RPI_DIR/.env"; then
  err "ABB_LOCAL_PASSWORD chybí v .env"; exit 1
fi
if ! grep -q "^TURSO_AUTH_TOKEN=.\+$" "$RPI_DIR/.env"; then
  err "TURSO_AUTH_TOKEN chybí v .env"; exit 1
fi
ok ".env validace OK"

# === 4. Test sběru ===
info "Testuji sběr dat (jednorázový běh)..."
if ONESHOT=1 DEBUG=1 node collect.mjs; then
  ok "Sběr funguje"
else
  err "Sběr selhal — zkontroluj .env, IP SysAPu (192.168.68.56?), heslo."
  exit 1
fi

# === 5. systemd služba ===
info "Instaluji systemd službu..."
SVC_FILE="/etc/systemd/system/meteo-collect.service"
sudo cp "$RPI_DIR/meteo-collect.service" "$SVC_FILE"
sudo sed -i "s|^User=raspi|User=$USER_NAME|" "$SVC_FILE"
sudo sed -i "s|^Group=raspi|Group=$USER_NAME|" "$SVC_FILE"
sudo sed -i "s|/home/raspi|$HOME|g" "$SVC_FILE"
sudo systemctl daemon-reload
sudo systemctl enable meteo-collect.service >/dev/null 2>&1
ok "systemd služba nainstalována (meteo-collect.service)"

# === 6. Starý cron pryč ===
if crontab -l 2>/dev/null | grep -q "collect.mjs"; then
  info "Odstraňuji starý cron job s collect.mjs..."
  (crontab -l 2>/dev/null | grep -v "collect.mjs") | crontab - || crontab -r
  ok "Starý cron odstraněn"
fi

# === 7. Optimalizace SD karty ===
echo
echo "=========================================="
echo " Optimalizace pro životnost SD karty"
echo "=========================================="

# 7a. Vypnout swap
if systemctl is-enabled dphys-swapfile &>/dev/null 2>&1; then
  info "Vypínám swap (Pi má 512 MB RAM, sběr žere ~30 MB)..."
  sudo dphys-swapfile swapoff || true
  sudo systemctl disable dphys-swapfile >/dev/null 2>&1 || true
  sudo apt-get remove --purge -y -qq dphys-swapfile >/dev/null 2>&1 || true
  ok "Swap vypnut"
else
  ok "Swap už je vypnutý"
fi

# 7b. journald do RAM
info "Nastavuji systemd-journald do volatile (RAM-only) módu..."
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/01-volatile.conf >/dev/null <<'EOF'
[Journal]
Storage=volatile
RuntimeMaxUse=32M
EOF
sudo systemctl restart systemd-journald
sudo rm -rf /var/log/journal/* 2>/dev/null || true
ok "Journald je v RAM (max 32 MB)"

# 7c. rsyslog odstranit (duplicitní k journald)
if dpkg -l 2>/dev/null | grep -q "^ii.*rsyslog"; then
  info "Odstraňuji rsyslog..."
  sudo systemctl stop rsyslog 2>/dev/null || true
  sudo systemctl disable rsyslog 2>/dev/null || true
  sudo apt-get remove --purge -y -qq rsyslog >/dev/null 2>&1 || true
  sudo rm -rf /var/log/syslog* /var/log/auth.log* /var/log/daemon.log* /var/log/kern.log* /var/log/messages* 2>/dev/null || true
  ok "rsyslog odstraněn"
fi

# 7d. log2ram (volitelné)
if ! command -v log2ram &>/dev/null; then
  info "Pokouším se nainstalovat log2ram..."
  if [ ! -f /etc/apt/sources.list.d/azlux.list ]; then
    sudo wget -qO /usr/share/keyrings/azlux-archive-keyring.gpg https://azlux.fr/repo.gpg 2>/dev/null || true
    if [ -f /usr/share/keyrings/azlux-archive-keyring.gpg ]; then
      echo "deb [signed-by=/usr/share/keyrings/azlux-archive-keyring.gpg] http://packages.azlux.fr/debian/ stable main" | sudo tee /etc/apt/sources.list.d/azlux.list >/dev/null
      sudo apt-get update -qq 2>/dev/null || true
    fi
  fi
  if sudo apt-get install -y -qq log2ram >/dev/null 2>&1; then
    sudo sed -i 's/^SIZE=.*/SIZE=64M/' /etc/log2ram.conf 2>/dev/null || true
    sudo systemctl enable log2ram >/dev/null 2>&1 || true
    ok "log2ram nainstalován"
  else
    warn "log2ram se nepodařilo nainstalovat (není kritické, journald už je v RAM)"
  fi
else
  ok "log2ram už je nainstalovaný"
fi

# 7e. Mount root s noatime,commit=600
if ! grep -E "^[^#].*\s+/\s+ext4.*noatime" /etc/fstab >/dev/null; then
  info "Přidávám noatime,commit=600 do /etc/fstab..."
  sudo cp /etc/fstab /etc/fstab.bak.$(date +%s)
  sudo sed -i -E 's|^([^#]\S+)\s+/\s+ext4\s+(\S+)\s+(\S+)\s+(\S+)$|\1 / ext4 \2,noatime,commit=600 \3 \4|' /etc/fstab
  if grep -E "/\s+ext4.*noatime" /etc/fstab >/dev/null; then
    ok "fstab upraven (noatime aktivní po rebootu)"
  else
    warn "fstab automatická úprava selhala — uprav ručně"
  fi
else
  ok "fstab už obsahuje noatime"
fi

# 7f. Zbytečné služby
info "Vypínám zbytečné služby..."
for svc in bluetooth hciuart triggerhappy avahi-daemon ModemManager wpa_supplicant.service@p2p-dev-wlan0; do
  sudo systemctl stop "$svc" 2>/dev/null || true
  sudo systemctl disable "$svc" 2>/dev/null || true
done
ok "Bluetooth, triggerhappy, avahi, ModemManager vypnuty"

# 7g. Vypnutí automatických apt updatů (vyhneme se zápisům na pozadí)
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Unattended-Upgrade "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
EOF
  ok "Automatické apt updaty vypnuty"
fi
sudo systemctl disable apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true

# 7h. Vypnout man-db cron (přebudovává man cache, hodně I/O)
sudo systemctl disable man-db.timer 2>/dev/null || true

# === 8. Restart služby ===
info "Spouštím službu meteo-collect..."
sudo systemctl restart meteo-collect.service
sleep 5
if systemctl is-active --quiet meteo-collect.service; then
  ok "Služba běží"
  sudo journalctl -u meteo-collect -n 5 --no-pager
else
  err "Služba neběží! Logy:"
  sudo journalctl -u meteo-collect -n 30 --no-pager
  exit 1
fi

# === 9. Souhrn ===
echo
echo "=========================================="
echo -e " ${GREEN}INSTALACE DOKONČENA${NC}"
echo "=========================================="
echo
echo " Stav služby:    sudo systemctl status meteo-collect"
echo " Live logy:      sudo journalctl -u meteo-collect -f"
echo " Debug log RAM:  tail -f /dev/shm/meteo.log"
echo " Restart:        sudo systemctl restart meteo-collect"
echo " Stop:           sudo systemctl stop meteo-collect"
echo " Update kódu:    cd ~/meteo && git pull && sudo systemctl restart meteo-collect"
echo
warn "Pro plnou aktivaci optimalizací restartuj Pi:"
echo "   sudo reboot"
echo
ok "Hotovo!"
