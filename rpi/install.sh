#!/bin/bash
# =============================================================================
# Instalační skript pro freeathome-meteo na Raspberry Pi
# Spustit jako: bash install.sh
# =============================================================================

set -e

echo "============================================"
echo "  freeathome-meteo — instalace na RPi"
echo "============================================"
echo ""

# === WiFi konfigurace ===
WIFI_SSID="NAZEV_VASI_WIFI"
WIFI_PASSWORD="HESLO_K_WIFI"

# 0. Nastavení WiFi (pokud ještě není připojeno)
if ! iwgetid -r &> /dev/null; then
    echo "WiFi není připojeno. Konfiguruji..."
    sudo nmcli dev wifi connect "$WIFI_SSID" password "$WIFI_PASSWORD" 2>/dev/null || \
    sudo bash -c "cat >> /etc/wpa_supplicant/wpa_supplicant.conf << WPAEOF

network={
    ssid=\"$WIFI_SSID\"
    psk=\"$WIFI_PASSWORD\"
    key_mgmt=WPA-PSK
}
WPAEOF"
    echo "✓ WiFi nastaveno: $WIFI_SSID"
    echo "  Restartujte RPi pokud se nepřipojí automaticky: sudo reboot"
else
    echo "✓ WiFi připojeno: $(iwgetid -r)"
fi
echo ""

# 1. Kontrola Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js nalezen: $NODE_VERSION"
else
    echo "✗ Node.js není nainstalován. Instaluji..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✓ Node.js nainstalován: $(node -v)"
fi

# 2. Přejít do složky skriptu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
echo ""
echo "Pracovní složka: $SCRIPT_DIR"

# 3. Nainstalovat závislosti
echo ""
echo "Instaluji závislosti..."
npm install --production
echo "✓ Závislosti nainstalovány"

# 4. Zkontrolovat .env
if [ ! -f .env ]; then
    echo ""
    echo "⚠  Soubor .env neexistuje!"
    echo "   Kopíruji .env.example → .env"
    cp .env.example .env
    echo ""
    echo "   DŮLEŽITÉ: Upravte .env soubor a vyplňte správné hodnoty:"
    echo "   nano $SCRIPT_DIR/.env"
    echo ""
    echo "   Potřebujete vyplnit:"
    echo "   - ABB_LOCAL_PASSWORD  (heslo k SysAP)"
    echo "   - TURSO_DATABASE_URL  (URL databáze)"
    echo "   - TURSO_AUTH_TOKEN    (přístupový token)"
    echo ""
    read -p "Chcete upravit .env nyní? (a/n): " EDIT_ENV
    if [ "$EDIT_ENV" = "a" ] || [ "$EDIT_ENV" = "A" ]; then
        nano .env
    fi
fi

# 5. Testovací spuštění
echo ""
read -p "Spustit testovací sběr dat? (a/n): " TEST_RUN
if [ "$TEST_RUN" = "a" ] || [ "$TEST_RUN" = "A" ]; then
    echo ""
    echo "Spouštím testovací sběr..."
    NODE_TLS_REJECT_UNAUTHORIZED=0 node collect.mjs
    echo ""
    if [ $? -eq 0 ]; then
        echo "✓ Testovací sběr proběhl úspěšně!"
    else
        echo "✗ Testovací sběr selhal. Zkontrolujte nastavení v .env"
        exit 1
    fi
fi

# 6. Nastavení cronu
echo ""
read -p "Nastavit automatický sběr každých 10 minut (cron)? (a/n): " SETUP_CRON
if [ "$SETUP_CRON" = "a" ] || [ "$SETUP_CRON" = "A" ]; then
    CRON_CMD="*/10 * * * * NODE_TLS_REJECT_UNAUTHORIZED=0 $(which node) $SCRIPT_DIR/collect.mjs >> $SCRIPT_DIR/collect.log 2>&1"

    # Odstraní starý záznam, pokud existuje
    crontab -l 2>/dev/null | grep -v "collect.mjs" | crontab -

    # Přidá nový
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

    echo "✓ Cron nastaven:"
    echo "  $CRON_CMD"
    echo ""
    echo "  Log: $SCRIPT_DIR/collect.log"
    echo "  Kontrola: crontab -l"
fi

# 7. Hotovo
echo ""
echo "============================================"
echo "  Instalace dokončena!"
echo "============================================"
echo ""
echo "Užitečné příkazy:"
echo "  Ruční sběr:     NODE_TLS_REJECT_UNAUTHORIZED=0 node $SCRIPT_DIR/collect.mjs"
echo "  Zobrazit log:   tail -f $SCRIPT_DIR/collect.log"
echo "  Cron:           crontab -l"
echo "  Editovat .env:  nano $SCRIPT_DIR/.env"
echo ""
