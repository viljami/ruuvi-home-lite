#!/bin/bash
set -e

echo "🚀 Setting up Ruuvi Home MQTT Broker..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "Please don't run as root. Use sudo when needed."
   exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt update
sudo apt install -y mosquitto mosquitto-clients nodejs npm build-essential python3-dev sqlite3 libsqlite3-dev

# Create directories
echo "📁 Creating directories..."
sudo mkdir -p /etc/mosquitto/ca_certificates
sudo mkdir -p /etc/mosquitto/certs
sudo mkdir -p /var/lib/mosquitto
sudo mkdir -p /var/log/mosquitto
sudo mkdir -p logs

# Setup environment file
echo "⚙️  Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from template"
else
    echo "⚠️  .env file already exists, keeping existing configuration"
fi

# Generate certificates
echo "🔐 Generating TLS certificates..."
cd /tmp

# CA key and certificate
openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=ruuvi-ca"

# Server key and certificate
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=localhost"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650

# Copy certificates
sudo cp ca.crt /etc/mosquitto/ca_certificates/
sudo cp server.crt /etc/mosquitto/certs/
sudo cp server.key /etc/mosquitto/certs/

# Set certificate permissions
sudo chown mosquitto:mosquitto /etc/mosquitto/certs/*
sudo chown mosquitto:mosquitto /etc/mosquitto/ca_certificates/*
sudo chmod 600 /etc/mosquitto/certs/server.key
sudo chmod 644 /etc/mosquitto/certs/server.crt
sudo chmod 644 /etc/mosquitto/ca_certificates/ca.crt

# Generate strong random password
echo "🔐 Generating secure MQTT password..."
MQTT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16 | tr -d '\n')

# Create MQTT user
echo "👤 Creating MQTT user..."
sudo mosquitto_passwd -c -b /etc/mosquitto/passwd ruuvi "$MQTT_PASSWORD"

# Detect local IP address for server binding
echo "🔍 Detecting local network IP..."
detect_local_ip() {
    # Try to find the best local IP address
    local ip_candidates=()
    
    # Get all IPv4 addresses, excluding loopback and docker interfaces
    while IFS= read -r line; do
        if [[ $line =~ inet[[:space:]]+([0-9.]+) ]]; then
            local ip="${BASH_REMATCH[1]}"
            local interface=$(echo "$line" | awk '{print $NF}')
            
            # Skip loopback and virtual interfaces
            if [[ $ip != "127."* && $interface != docker* && $interface != br-* && $interface != veth* ]]; then
                # Prioritize common local network ranges
                if [[ $ip =~ ^192\.168\. ]]; then
                    ip_candidates=("$ip" "${ip_candidates[@]}")  # Prepend (highest priority)
                elif [[ $ip =~ ^10\. ]] || [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; then
                    ip_candidates+=("$ip")  # Append (lower priority)
                fi
            fi
        fi
    done < <(ip addr show 2>/dev/null || ifconfig 2>/dev/null)
    
    # Return the best candidate or fallback
    if [ ${#ip_candidates[@]} -gt 0 ]; then
        echo "${ip_candidates[0]}"
    else
        # Fallback to hostname -I if our detection fails
        hostname -I | awk '{print $1}'
    fi
}

SERVER_IP=$(detect_local_ip)
echo "✅ Detected server IP: $SERVER_IP"

# Save password and IP securely for PM2 environment
echo "💾 Saving MQTT password and server IP to .env..."

# Ensure .env file exists before modifying it
if [ ! -f .env ]; then
    echo "⚠️  .env file missing, creating from template..."
    cp .env.example .env
fi

sed -i "s/MQTT_PASS=GENERATED_DURING_SETUP/MQTT_PASS=$MQTT_PASSWORD/" .env
sed -i "s/SERVER_IP=DETECTED_DURING_SETUP/SERVER_IP=$SERVER_IP/" .env
chmod 600 .env
echo "export MQTT_PASS='$MQTT_PASSWORD'" >> ~/.bashrc

# Copy configuration files
echo "⚙️  Setting up configuration..."
sudo cp config/mosquitto.conf /etc/mosquitto/mosquitto.conf
sudo cp config/acl /etc/mosquitto/acl

# Set proper permissions
sudo chown mosquitto:mosquitto /etc/mosquitto/passwd
sudo chown mosquitto:mosquitto /etc/mosquitto/acl
sudo chown mosquitto:mosquitto /var/lib/mosquitto
sudo chown mosquitto:mosquitto /var/log/mosquitto
sudo chmod 600 /etc/mosquitto/passwd

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build TypeScript
echo "🔨 Building application..."
npm run build

# Enable and start Mosquitto
echo "🚀 Starting MQTT broker..."
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
sudo systemctl status mosquitto --no-pager

# Configure firewall for local network access
echo "🔥 Configuring firewall for local network access..."
if command -v ufw >/dev/null 2>&1; then
    # Allow HTTPS web server (port 3000) from local network
    sudo ufw allow from 192.168.0.0/16 to any port 3000 comment 'Ruuvi Home HTTPS'
    sudo ufw allow from 10.0.0.0/8 to any port 3000 comment 'Ruuvi Home HTTPS'
    sudo ufw allow from 172.16.0.0/12 to any port 3000 comment 'Ruuvi Home HTTPS'
    
    # Allow MQTT broker (port 8883) from local network  
    sudo ufw allow from 192.168.0.0/16 to any port 8883 comment 'Ruuvi MQTT TLS'
    sudo ufw allow from 10.0.0.0/8 to any port 8883 comment 'Ruuvi MQTT TLS'
    sudo ufw allow from 172.16.0.0/12 to any port 8883 comment 'Ruuvi MQTT TLS'
    
    echo "✅ UFW firewall rules added for local network access"
else
    echo "⚠️  UFW not installed. Please manually configure firewall:"
    echo "   - Allow port 3000 (HTTPS) from local network"
    echo "   - Allow port 8883 (MQTT TLS) from local network"
fi

# Install PM2 globally
echo "🔧 Installing PM2..."
sudo npm install -g pm2

# Setup PM2 startup
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo "✅ Setup complete!"
echo ""
echo "🔧 RUUVI GATEWAY CONFIGURATION:"
echo "================================"
echo "MQTT Broker: $(hostname -I | awk '{print $1}'):8883"
echo "Protocol: MQTT over TLS"
echo "Username: ruuvi"
echo "Password: $MQTT_PASSWORD"
echo "Topic Format: ruuvi/{gateway_id}/{sensor_mac}"
echo "Alternative: gateway/{gateway_id}/{sensor_mac}"
echo ""
echo "📡 Expected payload: Gateway JSON with BLE advertisement data"
echo "Example topic: ruuvi/gateway_id/sensor_mac"
echo "Example payload:"
echo '{"gw_mac":"A1:B2:C3:D4:E5:F6","rssi":-62,"aoa":[],"gwts":1728719836,"ts":1728719836,"data":"0201061BFF9904050F18FFFFFFFFFFF0FFEC0414AA96A8DE8E123456789ABC","coords":""}'
echo ""
echo "📖 Official Documentation:"
echo "https://docs.ruuvi.com/ruuvi-gateway-firmware/gw-data-formats"
echo ""
echo "🔑 MQTT Password saved to: $(pwd)/.env"
echo "   (Password will be loaded automatically by PM2)"
echo "   ⚠️  Keep .env file secure - never commit to version control!"
echo ""
echo "🚀 To start the application:"
echo "make start"
echo ""
echo "🔒 Security Notes:"
echo "- .env file contains sensitive passwords (mode 600, user-only access)"
echo "- Generated certificates are self-signed for local network use only"
echo "- Firewall configured for local network access only"
echo "- Monitor PM2 logs: pm2 logs ruuvi-home"
echo ""
echo "🌐 Network Access:"
echo "- Dashboard: https://$(hostname -I | awk '{print $1}'):3000"
echo "- MQTT Broker: $(hostname -I | awk '{print $1}'):8883"
echo "- Accessible from any device on your local network"
echo "- Self-signed certificate - browsers will show security warning (click 'Advanced' → 'Proceed')"