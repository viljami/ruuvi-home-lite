#!/bin/bash
set -e

echo "🧹 Ruuvi Home Lite - Complete Cleanup Script (Monorepo)"
echo "======================================================="
echo ""
echo "⚠️  WARNING: This will completely remove Ruuvi Home Lite installation!"
echo "    - Stop all services (PM2, Mosquitto, Docker)"
echo "    - Remove certificates and credentials"
echo "    - Remove databases and logs"
echo "    - Remove build artifacts from all packages"
echo "    - Remove system configurations"
echo "    - Optionally remove installed packages"
echo ""

# Function to ask for confirmation
confirm() {
    local prompt="$1"
    local default="${2:-N}"
    
    if [[ $default == "Y" ]]; then
        local options="[Y/n]"
    else
        local options="[y/N]"
    fi
    
    read -p "$prompt $options: " -r response
    
    if [[ $default == "Y" ]]; then
        [[ ! $response =~ ^[Nn]$ ]]
    else
        [[ $response =~ ^[Yy]$ ]]
    fi
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Please don't run as root. Use sudo when needed."
   exit 1
fi

# Final confirmation
echo "🤔 Are you absolutely sure you want to completely remove Ruuvi Home Lite?"
if ! confirm "This action cannot be undone" "N"; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting cleanup process..."

# Stop PM2 processes
echo "🛑 Stopping PM2 processes..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop ruuvi-home 2>/dev/null || true
    pm2 delete ruuvi-home 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    echo "✅ PM2 processes stopped"
else
    echo "ℹ️  PM2 not found, skipping"
fi

# Stop Mosquitto service
echo "🛑 Stopping Mosquitto service..."
if systemctl is-active --quiet mosquitto 2>/dev/null; then
    sudo systemctl stop mosquitto
    sudo systemctl disable mosquitto
    echo "✅ Mosquitto service stopped and disabled"
else
    echo "ℹ️  Mosquitto service not running"
fi

# Remove Mosquitto configurations
echo "🗑️  Removing Mosquitto configurations..."
sudo rm -f /etc/mosquitto/mosquitto.conf
sudo rm -f /etc/mosquitto/passwd
sudo rm -f /etc/mosquitto/acl
sudo rm -rf /etc/mosquitto/certs/
sudo rm -rf /etc/mosquitto/ca_certificates/
sudo rm -rf /var/lib/mosquitto/
sudo rm -rf /var/log/mosquitto/
echo "✅ Mosquitto configurations removed"

# Remove Ruuvi Home certificates
echo "🗑️  Removing Ruuvi Home certificates..."
sudo rm -rf /etc/ruuvi-home/
echo "✅ Ruuvi Home certificates removed"

# Remove firewall rules
echo "🔥 Removing firewall rules..."
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status | grep -q "Status: active"; then
        # Remove UFW rules
        sudo ufw --force delete allow from 192.168.0.0/16 to any port 3000 2>/dev/null || true
        sudo ufw --force delete allow from 10.0.0.0/8 to any port 3000 2>/dev/null || true
        sudo ufw --force delete allow from 172.16.0.0/12 to any port 3000 2>/dev/null || true
        sudo ufw --force delete allow from 192.168.0.0/16 to any port 8883 2>/dev/null || true
        sudo ufw --force delete allow from 10.0.0.0/8 to any port 8883 2>/dev/null || true
        sudo ufw --force delete allow from 172.16.0.0/12 to any port 8883 2>/dev/null || true
        echo "✅ UFW firewall rules removed"
    fi
elif command -v firewall-cmd >/dev/null 2>&1; then
    if sudo firewall-cmd --state >/dev/null 2>&1; then
        # Remove firewalld rules
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='192.168.0.0/16' port protocol='tcp' port='3000' accept" 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='192.168.0.0/16' port protocol='tcp' port='8883' accept" 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='10.0.0.0/8' port protocol='tcp' port='3000' accept" 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='10.0.0.0/8' port protocol='tcp' port='8883' accept" 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='172.16.0.0/12' port protocol='tcp' port='3000' accept" 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-rich-rule="rule family='ipv4' source address='172.16.0.0/12' port protocol='tcp' port='8883' accept" 2>/dev/null || true
        sudo firewall-cmd --reload
        echo "✅ Firewalld rules removed"
    fi
else
    echo "ℹ️  No supported firewall found"
fi

# Remove PM2 startup configuration
echo "🗑️  Removing PM2 startup configuration..."
if command -v pm2 >/dev/null 2>&1; then
    sudo pm2 unstartup systemd 2>/dev/null || true
    rm -f ~/.pm2/dump.pm2 2>/dev/null || true
    echo "✅ PM2 startup configuration removed"
fi

# Clean application files
echo "🗑️  Removing application files..."
rm -f .env
rm -f .env.tmp
rm -rf node_modules/
rm -rf dist/
rm -rf logs/
rm -rf certs/
rm -f *.db
rm -f ruuvi_*.db*
rm -f *log
echo "✅ Application files removed"

# Remove from bashrc
echo "🗑️  Cleaning bashrc..."
sed -i '/export MQTT_PASS=/d' ~/.bashrc 2>/dev/null || true
echo "✅ Environment variables removed from bashrc"

# Reset systemd failure states
echo "🔄 Resetting systemd failure states..."
sudo systemctl reset-failed mosquitto 2>/dev/null || true
echo "✅ Systemd states reset"

# Ask about removing packages
echo ""
if confirm "🤔 Remove installed packages (Node.js, npm, Mosquitto, build tools)?" "N"; then
    echo "📦 Removing packages..."
    
    # Remove Node.js and npm
    if command -v node >/dev/null 2>&1; then
        if confirm "   Remove Node.js and npm?" "Y"; then
            sudo apt remove --purge -y nodejs npm 2>/dev/null || true
            echo "   ✅ Node.js and npm removed"
        fi
    fi
    
    # Remove Mosquitto
    if dpkg -l | grep -q mosquitto 2>/dev/null; then
        if confirm "   Remove Mosquitto MQTT broker?" "Y"; then
            sudo apt remove --purge -y mosquitto mosquitto-clients 2>/dev/null || true
            echo "   ✅ Mosquitto removed"
        fi
    fi
    
    # Remove build tools
    if confirm "   Remove build tools (build-essential, python3-dev)?" "N"; then
        sudo apt remove --purge -y build-essential python3-dev 2>/dev/null || true
        echo "   ✅ Build tools removed"
    fi
    
    # Remove PM2 globally
    if command -v pm2 >/dev/null 2>&1; then
        if confirm "   Remove PM2 process manager?" "Y"; then
            sudo npm uninstall -g pm2 2>/dev/null || true
            echo "   ✅ PM2 removed"
        fi
    fi
    
    # Clean package cache
    sudo apt autoremove -y 2>/dev/null || true
    sudo apt autoclean 2>/dev/null || true
    echo "   ✅ Package cache cleaned"
else
    echo "ℹ️  Packages kept (you can remove manually later)"
fi

# Ask about removing entire project directory
echo ""
if confirm "🤔 Remove entire project directory?" "N"; then
    echo "🗑️  This will remove the entire ruuvi-home-lite directory"
    if confirm "   Are you sure? This cannot be undone!" "N"; then
        cd ..
        rm -rf ruuvi-home-lite/
        echo "✅ Project directory removed"
        echo ""
        echo "🎉 Complete cleanup finished!"
        echo "   The ruuvi-home-lite directory has been removed."
        exit 0
    fi
fi

# Verify ports are freed
echo ""
echo "🔍 Verifying ports are freed..."
if ss -ln | grep -q ":3000 "; then
    echo "⚠️  Port 3000 still in use:"
    ss -tlnp | grep ":3000"
else
    echo "✅ Port 3000 is free"
fi

if ss -ln | grep -q ":8883 "; then
    echo "⚠️  Port 8883 still in use:"
    ss -tlnp | grep ":8883"
else
    echo "✅ Port 8883 is free"
fi

echo ""
echo "🎉 Cleanup completed successfully!"
echo ""
echo "📋 Summary of what was removed:"
echo "   ✅ PM2 processes and startup configuration"
echo "   ✅ Mosquitto service and configurations"
echo "   ✅ TLS certificates and credentials"
echo "   ✅ Application files and databases"
echo "   ✅ Log files and temporary data"
echo "   ✅ Firewall rules"
echo "   ✅ Environment variables"
echo ""
echo "🔄 What remains:"
echo "   ℹ️  System packages (unless you chose to remove them)"
echo "   ℹ️  Git repository files (unless you chose to remove directory)"
echo "   ℹ️  System users (mosquitto user may still exist)"
echo ""
echo "💡 To completely start fresh:"
echo "   1. Remove this directory: cd .. && rm -rf ruuvi-home-lite"
echo "   2. Clone repository again: git clone <repository-url>"
echo "   3. Run setup: cd ruuvi-home-lite && ./setup.sh"
echo ""
echo "🏁 Cleanup script finished."