#!/bin/bash
set -e

echo "🗑️  Ruuvi Home Lite - Quick Removal Script"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will completely remove everything!"
echo ""

read -p "Type 'REMOVE' to confirm complete removal: " confirmation

if [ "$confirmation" != "REMOVE" ]; then
    echo "❌ Removal cancelled."
    exit 0
fi

echo ""
echo "🚀 Removing Ruuvi Home Lite..."

# Stop all services
echo "🛑 Stopping services..."
pm2 stop ruuvi-home 2>/dev/null || true
pm2 delete ruuvi-home 2>/dev/null || true
pm2 kill 2>/dev/null || true
sudo systemctl stop mosquitto 2>/dev/null || true
sudo systemctl disable mosquitto 2>/dev/null || true

# Remove packages
echo "📦 Removing packages..."
sudo apt remove --purge -y mosquitto mosquitto-clients 2>/dev/null || true
sudo npm uninstall -g pm2 2>/dev/null || true

# Remove system files
echo "🗑️  Removing system files..."
sudo rm -rf /etc/mosquitto/
sudo rm -rf /etc/ruuvi-home/
sudo rm -rf /var/lib/mosquitto/
sudo rm -rf /var/log/mosquitto/

# Remove firewall rules
echo "🔥 Removing firewall rules..."
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
    sudo ufw --force delete allow 3000 2>/dev/null || true
    sudo ufw --force delete allow 8883 2>/dev/null || true
fi

# Remove PM2 startup
echo "🔄 Removing PM2 startup..."
sudo pm2 unstartup systemd 2>/dev/null || true
rm -rf ~/.pm2/ 2>/dev/null || true

# Clean bashrc
echo "🧹 Cleaning bashrc..."
sed -i '/export MQTT_PASS=/d' ~/.bashrc 2>/dev/null || true

# Remove application files
echo "🗑️  Removing application files..."
rm -f .env .env.* 
rm -rf node_modules/ dist/ logs/ certs/
rm -f *.db *.log ruuvi_*

# Reset systemd
sudo systemctl reset-failed 2>/dev/null || true

# Clean packages
sudo apt autoremove -y 2>/dev/null || true
sudo apt autoclean 2>/dev/null || true

echo ""
echo "✅ Removal complete!"
echo ""
echo "🏁 To remove this directory: cd .. && rm -rf ruuvi-home-lite"