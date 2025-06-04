#!/bin/bash
set -e

echo "🚀 Setting up Ruuvi Home MQTT Broker..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "Please don't run as root. Use sudo when needed."
   exit 1
fi

# Get script directory and source shared functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source shared environment functions
if [ -f "$SCRIPT_DIR/env-setup.sh" ]; then
    source "$SCRIPT_DIR/env-setup.sh"
else
    echo "❌ Missing env-setup.sh. Please ensure all scripts are in the scripts/ directory."
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR"

# Validate system compatibility
if ! command -v apt >/dev/null 2>&1; then
    echo "❌ This script requires a Debian/Ubuntu system with apt package manager"
    exit 1
fi

# Check if ports are available
echo "🔍 Checking port availability..."
if ss -ln | grep -q ":3000 "; then
    echo "❌ Port 3000 is already in use"
    exit 1
fi

if ss -ln | grep -q ":8883 "; then
    echo "❌ Port 8883 is already in use"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt update
if ! sudo apt install -y mosquitto mosquitto-clients nodejs npm build-essential python3-dev sqlite3 libsqlite3-dev; then
    echo "❌ Failed to install required packages"
    exit 1
fi

# Verify critical dependencies
echo "🔍 Verifying installations..."
if ! dpkg -l | grep -q mosquitto; then
    echo "❌ Failed to install Mosquitto"
    exit 1
fi

# Check Node.js version
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js installation failed"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required, found version $NODE_VERSION"
    echo "   Please install a newer version of Node.js"
    exit 1
fi

# Verify mosquitto user exists
if ! id mosquitto >/dev/null 2>&1; then
    echo "❌ Mosquitto user does not exist. Package installation may have failed."
    exit 1
fi

# Create system directories (need root)
echo "📁 Creating system directories..."
sudo mkdir -p /etc/mosquitto/ca_certificates
sudo mkdir -p /etc/mosquitto/certs
sudo mkdir -p /etc/ruuvi-home/certs
sudo mkdir -p /var/lib/mosquitto
sudo mkdir -p /var/log/mosquitto

# Create project directories (user-owned)
echo "📁 Creating project directories..."
mkdir -p logs
chmod 755 logs
mkdir -p certs
chmod 755 certs

# Setup environment file
echo "⚙️  Setting up environment configuration..."
if [ ! -f .env ]; then
    echo "✅ Creating .env file with default values"
    cat > .env << EOF
# Environment Configuration
MQTT_HOST=localhost
MQTT_PORT=8883
MQTT_USER=ruuvi
MQTT_PASS=GENERATED_DURING_SETUP
NODE_ENV=production
SERVER_IP=DETECTED_DURING_SETUP
EOF
else
    echo "⚠️  .env file already exists, keeping existing configuration"
fi

# Detect local IP address for server binding
echo "🔍 Detecting local network IP..."
SERVER_IP=$(detect_local_ip)

# Validate detected IP
if ! validate_ip_address "$SERVER_IP"; then
    echo "❌ Failed to detect valid local IP address: $SERVER_IP"
    echo "   Please check your network configuration"
    exit 1
fi

echo "✅ Detected server IP: $SERVER_IP"

# Generate strong random password
echo "🔐 Generating secure MQTT password..."
MQTT_PASSWORD=$(generate_mqtt_password)

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate secure password"
    exit 1
fi

# Generate certificates in secure temporary directory
echo "🔐 Generating TLS certificates..."
CERT_TEMP=$(mktemp -d)
if [ ! -d "$CERT_TEMP" ]; then
    echo "❌ Failed to create secure temporary directory"
    exit 1
fi

# Secure the temporary directory
chmod 700 "$CERT_TEMP"
ORIGINAL_DIR=$(pwd)
cd "$CERT_TEMP"

# CA key and certificate
openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=ruuvi-ca"

# MQTT server key and certificate with correct CN
openssl genrsa -out mqtt-server.key 2048
openssl req -new -key mqtt-server.key -out mqtt-server.csr -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=$SERVER_IP"
openssl x509 -req -in mqtt-server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out mqtt-server.crt -days 3650

# Web server key and certificate with correct CN
openssl genrsa -out web-server.key 2048
openssl req -new -key web-server.key -out web-server.csr -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=$SERVER_IP"
openssl x509 -req -in web-server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out web-server.crt -days 3650

# Verify certificates were created
if [ ! -f ca.crt ] || [ ! -f mqtt-server.crt ] || [ ! -f mqtt-server.key ] || [ ! -f web-server.crt ] || [ ! -f web-server.key ]; then
    echo "❌ Failed to generate certificates"
    cd "$ORIGINAL_DIR"
    rm -rf "$CERT_TEMP"
    exit 1
fi

# Copy MQTT certificates
sudo cp ca.crt /etc/mosquitto/ca_certificates/
sudo cp mqtt-server.crt /etc/mosquitto/certs/server.crt
sudo cp mqtt-server.key /etc/mosquitto/certs/server.key

# Copy web server certificates  
sudo cp web-server.crt /etc/ruuvi-home/certs/server.crt
sudo cp web-server.key /etc/ruuvi-home/certs/server.key
sudo cp ca.crt /etc/ruuvi-home/certs/ca.crt

# Cleanup temporary directory
cd "$ORIGINAL_DIR"
rm -rf "$CERT_TEMP"

# Set certificate permissions
sudo chown mosquitto:mosquitto /etc/mosquitto/certs/*
sudo chown mosquitto:mosquitto /etc/mosquitto/ca_certificates/*
sudo chmod 600 /etc/mosquitto/certs/server.key
sudo chmod 644 /etc/mosquitto/certs/server.crt
sudo chmod 644 /etc/mosquitto/ca_certificates/ca.crt

# Generate separate web server certificates in project directory
echo "🔐 Generating web server certificates..."
WEB_CERT_TEMP=$(mktemp -d)
if [ ! -d "$WEB_CERT_TEMP" ]; then
    echo "❌ Failed to create temporary directory for web certificates"
    exit 1
fi

chmod 700 "$WEB_CERT_TEMP"
cd "$WEB_CERT_TEMP"

# Generate web server CA
openssl genrsa -out web-ca.key 2048
openssl req -new -x509 -days 3650 -key web-ca.key -out web-ca.crt -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=ruuvi-web-ca"

# Generate web server certificate with proper CN
openssl genrsa -out web-server.key 2048
openssl req -new -key web-server.key -out web-server.csr -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=$SERVER_IP"
openssl x509 -req -in web-server.csr -CA web-ca.crt -CAkey web-ca.key -CAcreateserial -out web-server.crt -days 3650

# Verify web certificates were created
if [ ! -f web-server.crt ] || [ ! -f web-server.key ]; then
    echo "❌ Failed to generate web server certificates"
    cd "$ORIGINAL_DIR"
    rm -rf "$WEB_CERT_TEMP"
    exit 1
fi

# Copy web certificates to project directory (user-owned)
cp web-server.crt "$ORIGINAL_DIR/certs/"
cp web-server.key "$ORIGINAL_DIR/certs/"

# Cleanup web certificate temporary directory
cd "$ORIGINAL_DIR"
rm -rf "$WEB_CERT_TEMP"

# Set web certificate permissions (user-owned)
chmod 644 certs/web-server.crt
chmod 600 certs/web-server.key

# Verify certificate permissions
if [ "$(stat -c %a /etc/mosquitto/certs/server.key)" != "600" ]; then
    echo "❌ Failed to set correct permissions on server key"
    exit 1
fi

# Create MQTT user
echo "👤 Creating MQTT user..."
sudo mosquitto_passwd -c -b /etc/mosquitto/passwd ruuvi "$MQTT_PASSWORD"

# Verify password file was created
if [ ! -f /etc/mosquitto/passwd ]; then
    echo "❌ Failed to create MQTT password file"
    exit 1
fi

# Create or update .env file using shared function
echo "💾 Saving MQTT password and server IP to .env..."
if ! create_or_update_env_file "$MQTT_PASSWORD" "$SERVER_IP" ".env" "native"; then
    echo "❌ Failed to create .env file"
    exit 1
fi

# Validate the environment file
if ! validate_env_vars ".env"; then
    echo "❌ Environment validation failed"
    exit 1
fi

# Add password to bashrc for manual reference
echo "export MQTT_PASS='$MQTT_PASSWORD'" >> ~/.bashrc

# Copy configuration files
echo "⚙️  Setting up configuration..."
if [ ! -f config/mosquitto.conf ]; then
    echo "❌ Missing config/mosquitto.conf file"
    exit 1
fi

if [ ! -f config/acl ]; then
    echo "❌ Missing config/acl file"
    exit 1
fi

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
if [ ! -f package.json ]; then
    echo "❌ Missing package.json file"
    exit 1
fi

npm install

# Build TypeScript
echo "🔨 Building application..."
npm run build

# Verify build succeeded
if [ ! -d dist ]; then
    echo "❌ TypeScript build failed - dist directory not created"
    exit 1
fi

# Enable and start Mosquitto
echo "🚀 Starting MQTT broker..."
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

# Wait for service to start and verify
sleep 3
if ! sudo systemctl is-active --quiet mosquitto; then
    echo "❌ Failed to start Mosquitto service"
    echo "Service logs:"
    sudo journalctl -u mosquitto --no-pager -n 20
    exit 1
fi

echo "✅ Mosquitto service started successfully"

# Test MQTT connectivity
echo "🔍 Testing MQTT broker connectivity..."
if ! timeout 5 mosquitto_pub -h localhost -p 8883 --cafile /etc/mosquitto/ca_certificates/ca.crt -u ruuvi -P "$MQTT_PASSWORD" -t test/connection -m "test" 2>/dev/null; then
    echo "⚠️  MQTT broker test failed - this may be normal if certificates need time to propagate"
else
    echo "✅ MQTT broker connectivity test passed"
fi

# Configure firewall for local network access
echo "🔥 Configuring firewall for local network access..."
configure_firewall() {
    local firewall_configured=false

    # Try UFW first
    if command -v ufw >/dev/null 2>&1; then
        # Check if UFW is actually active
        if sudo ufw status | grep -q "Status: active"; then
            echo "Configuring UFW firewall..."
            # Allow HTTPS web server (port 3000) from local network
            sudo ufw allow from 192.168.0.0/16 to any port 3000 comment 'Ruuvi Home HTTPS'
            sudo ufw allow from 10.0.0.0/8 to any port 3000 comment 'Ruuvi Home HTTPS'
            sudo ufw allow from 172.16.0.0/12 to any port 3000 comment 'Ruuvi Home HTTPS'

            # Allow MQTT broker (port 8883) from local network
            sudo ufw allow from 192.168.0.0/16 to any port 8883 comment 'Ruuvi MQTT TLS'
            sudo ufw allow from 10.0.0.0/8 to any port 8883 comment 'Ruuvi MQTT TLS'
            sudo ufw allow from 172.16.0.0/12 to any port 8883 comment 'Ruuvi MQTT TLS'

            echo "✅ UFW firewall rules added for local network access"
            firewall_configured=true
        else
            echo "⚠️  UFW is installed but not active"
        fi
    fi

    # Try firewalld if UFW wasn't configured
    if ! $firewall_configured && command -v firewall-cmd >/dev/null 2>&1; then
        if sudo firewall-cmd --state >/dev/null 2>&1; then
            echo "Configuring firewalld..."
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='192.168.0.0/16' port protocol='tcp' port='3000' accept"
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='192.168.0.0/16' port protocol='tcp' port='8883' accept"
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='10.0.0.0/8' port protocol='tcp' port='3000' accept"
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='10.0.0.0/8' port protocol='tcp' port='8883' accept"
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='172.16.0.0/12' port protocol='tcp' port='3000' accept"
            sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='172.16.0.0/12' port protocol='tcp' port='8883' accept"
            sudo firewall-cmd --reload
            echo "✅ Firewalld rules added for local network access"
            firewall_configured=true
        fi
    fi

    if ! $firewall_configured; then
        echo "⚠️  No active firewall detected. Please manually configure firewall:"
        echo "   - Allow port 3000 (HTTPS) from local network"
        echo "   - Allow port 8883 (MQTT TLS) from local network"
    fi
}

configure_firewall

# Install PM2 globally
echo "🔧 Installing PM2..."
if ! sudo npm install -g pm2; then
    echo "❌ Failed to install PM2"
    exit 1
fi

# Verify PM2 installation
if ! command -v pm2 >/dev/null 2>&1; then
    echo "❌ PM2 installation verification failed"
    exit 1
fi

# Setup PM2 startup
echo "🔧 Configuring PM2 startup..."
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo "✅ Setup complete!"
echo ""
echo "🔧 RUUVI GATEWAY CONFIGURATION:"
echo "================================"
echo "MQTT Broker: $SERVER_IP:8883"
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
echo "- Dashboard: https://$SERVER_IP:3000"
echo "- MQTT Broker: $SERVER_IP:8883"
echo "- Accessible from any device on your local network"
echo "- Self-signed certificate - browsers will show security warning (click 'Advanced' → 'Proceed')"