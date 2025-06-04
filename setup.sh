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

# Save password securely for PM2 environment
echo "💾 Saving MQTT password to .env..."
sed -i "s/MQTT_PASS=GENERATED_DURING_SETUP/MQTT_PASS=$MQTT_PASSWORD/" .env
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
echo "- Monitor PM2 logs: pm2 logs ruuvi-home"
echo ""
echo "📊 Access dashboard: https://$(hostname -I | awk '{print $1}'):3000"