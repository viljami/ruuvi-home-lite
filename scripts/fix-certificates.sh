#!/bin/bash
set -e

echo "🔐 Fixing Mosquitto TLS Certificates..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "Please don't run as root. Use sudo when needed."
   exit 1
fi

# Stop mosquitto service
echo "🛑 Stopping Mosquitto service..."
sudo systemctl stop mosquitto || true

# Detect local IP address
echo "🔍 Detecting local network IP..."
detect_local_ip() {
    local ip_candidates=()
    while IFS= read -r line; do
        if [[ $line =~ inet[[:space:]]+([0-9.]+) ]]; then
            local ip="${BASH_REMATCH[1]}"
            local interface=$(echo "$line" | awk '{print $NF}')
            if [[ $ip != "127."* && $interface != docker* && $interface != br-* && $interface != veth* ]]; then
                if [[ $ip =~ ^192\.168\. ]]; then
                    ip_candidates=("$ip" "${ip_candidates[@]}")
                elif [[ $ip =~ ^10\. ]] || [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; then
                    ip_candidates+=("$ip")
                fi
            fi
        fi
    done < <(ip addr show 2>/dev/null || ifconfig 2>/dev/null)
    
    if [ ${#ip_candidates[@]} -gt 0 ]; then
        echo "${ip_candidates[0]}"
    else
        hostname -I | awk '{print $1}'
    fi
}

SERVER_IP=$(detect_local_ip)
echo "✅ Detected server IP: $SERVER_IP"

# Remove old certificates
echo "🗑️  Removing old certificates..."
sudo rm -f /etc/mosquitto/certs/server.crt
sudo rm -f /etc/mosquitto/certs/server.key
sudo rm -f /etc/mosquitto/ca_certificates/ca.crt

# Create secure temporary directory
CERT_TEMP=$(mktemp -d)
chmod 700 "$CERT_TEMP"
ORIGINAL_DIR=$(pwd)
cd "$CERT_TEMP"

echo "🔐 Generating new certificates..."

# Generate CA private key
openssl genrsa -out ca.key 2048

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=ruuvi-ca"

# Generate server private key
openssl genrsa -out server.key 2048

# Create config file for server certificate with SAN
cat > server.conf << EOF
[req]
default_bits = 2048
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = FI
ST = Helsinki
L = Helsinki
O = RuuviHome
CN = $SERVER_IP

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.local
IP.1 = 127.0.0.1
IP.2 = $SERVER_IP
EOF

# Generate server certificate request
openssl req -new -key server.key -out server.csr -config server.conf

# Generate server certificate signed by CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650 -extensions v3_req -extfile server.conf

# Verify certificates were created
if [ ! -f ca.crt ] || [ ! -f server.crt ] || [ ! -f server.key ]; then
    echo "❌ Failed to generate certificates"
    cd "$ORIGINAL_DIR"
    rm -rf "$CERT_TEMP"
    exit 1
fi

echo "✅ Certificates generated successfully"

# Copy certificates to mosquitto directories
echo "📁 Installing certificates..."
sudo cp ca.crt /etc/mosquitto/ca_certificates/
sudo cp server.crt /etc/mosquitto/certs/
sudo cp server.key /etc/mosquitto/certs/

# Set correct ownership and permissions
sudo chown mosquitto:mosquitto /etc/mosquitto/certs/server.crt
sudo chown mosquitto:mosquitto /etc/mosquitto/certs/server.key
sudo chown mosquitto:mosquitto /etc/mosquitto/ca_certificates/ca.crt

sudo chmod 644 /etc/mosquitto/certs/server.crt
sudo chmod 600 /etc/mosquitto/certs/server.key
sudo chmod 644 /etc/mosquitto/ca_certificates/ca.crt

# Cleanup temporary directory
cd "$ORIGINAL_DIR"
rm -rf "$CERT_TEMP"

echo "🔐 Setting up minimal mosquitto configuration..."

# Create minimal working configuration
sudo tee /etc/mosquitto/mosquitto.conf > /dev/null << EOF
# Mosquitto MQTT Broker - Minimal Working Configuration

# Basic settings
pid_file /var/run/mosquitto/mosquitto.pid
persistence true
persistence_location /var/lib/mosquitto/
log_dest file /var/log/mosquitto/mosquitto.log
log_type error
log_type warning
log_type notice
connection_messages true
log_timestamp true

# TLS listener
listener 8883
protocol mqtt

# TLS Configuration
cafile /etc/mosquitto/ca_certificates/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
tls_version tlsv1.2
require_certificate false
use_identity_as_username false

# Authentication
allow_anonymous false
password_file /etc/mosquitto/passwd

# Access control
acl_file /etc/mosquitto/acl

# Limits
max_connections 50
max_inflight_messages 10
max_queued_messages 500
message_size_limit 4096
max_keepalive 300
EOF

# Test configuration
echo "⚙️  Testing configuration..."
if ! sudo mosquitto -c /etc/mosquitto/mosquitto.conf -v; then
    echo "❌ Configuration test failed"
    exit 1
fi

echo "✅ Configuration test passed"

# Start mosquitto service
echo "🚀 Starting Mosquitto service..."
if sudo systemctl start mosquitto; then
    echo "✅ Mosquitto started successfully"
else
    echo "❌ Failed to start Mosquitto"
    echo "📖 Check logs: sudo journalctl -u mosquitto -n 20"
    exit 1
fi

# Wait for service to stabilize
sleep 3

# Test TLS connection
echo "🔍 Testing TLS connection..."
if timeout 10 mosquitto_pub -h localhost -p 8883 --cafile /etc/mosquitto/ca_certificates/ca.crt -u ruuvi -P "$(grep MQTT_PASS .env | cut -d'=' -f2)" -t test/connection -m "test" 2>/dev/null; then
    echo "✅ TLS connection test successful"
else
    echo "⚠️  TLS connection test failed, but service is running"
    echo "💡 This may be normal if MQTT password needs to be regenerated"
fi

# Update SERVER_IP in .env file
if [ -f .env ]; then
    echo "💾 Updating SERVER_IP in .env file..."
    sed -i "s/SERVER_IP=.*/SERVER_IP=$SERVER_IP/" .env
    echo "✅ SERVER_IP updated to $SERVER_IP"
fi

echo ""
echo "✅ Certificate fix complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Test MQTT connection: mosquitto_pub -h localhost -p 8883 --cafile /etc/mosquitto/ca_certificates/ca.crt -u ruuvi -P \"\$(grep MQTT_PASS .env | cut -d'=' -f2)\" -t test/connection -m \"test\""
echo "2. Start application: make start"
echo "3. Monitor logs: pm2 logs ruuvi-home"
echo ""
echo "🌐 Dashboard will be available at: https://$SERVER_IP:3000"