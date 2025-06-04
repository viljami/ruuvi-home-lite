#!/bin/bash
set -e

echo "🐳 Initializing Docker volumes for Mosquitto..."

# Get script directory and source shared functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source shared environment functions
if [ -f "$SCRIPT_DIR/env-setup.sh" ]; then
    source "$SCRIPT_DIR/env-setup.sh"
else
    echo "❌ Missing env-setup.sh"
    exit 1
fi

cd "$PROJECT_DIR"

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo "❌ .env.docker not found. Run ./setup-docker.sh first."
    exit 1
fi

# Source environment variables
source .env.docker

# Validate required variables
if [ -z "$MQTT_PASS" ] || [ -z "$SERVER_IP" ]; then
    echo "❌ Missing required environment variables in .env.docker"
    exit 1
fi

# Create temporary directory for certificate generation
CERT_TEMP=$(mktemp -d)
chmod 700 "$CERT_TEMP"
cd "$CERT_TEMP"

echo "🔐 Generating certificates for Docker deployment..."

# Generate CA private key
openssl genrsa -out ca.key 2048

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=FI/ST=Helsinki/L=Helsinki/O=RuuviHome/CN=ruuvi-docker-ca"

# Generate server private key
openssl genrsa -out server.key 2048

# Create server certificate config with proper DNS names for Docker
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
CN = mosquitto

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = mosquitto
DNS.2 = ruuvi-mosquitto
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = $SERVER_IP
EOF

# Generate server certificate request
openssl req -new -key server.key -out server.csr -config server.conf

# Generate server certificate signed by CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650 -extensions v3_req -extfile server.conf

# Create temporary mosquitto config for Docker
cat > mosquitto.conf << EOF
# Mosquitto Docker Configuration
pid_file /var/run/mosquitto/mosquitto.pid
persistence true
persistence_location /mosquitto/data/
log_dest stdout
log_type error
log_type warning
log_type notice
connection_messages true
log_timestamp true

# TLS listener
listener 8883
protocol mqtt

# TLS Configuration
cafile /mosquitto/config/ca_certificates/ca.crt
certfile /mosquitto/config/certs/server.crt
keyfile /mosquitto/config/certs/server.key
tls_version tlsv1.2
require_certificate false
use_identity_as_username false

# Authentication
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl

# Connection limits
max_connections 50
max_inflight_messages 10
max_queued_messages 500
message_size_limit 4096
max_keepalive 300
EOF

# Generate MQTT password file
echo "ruuvi:$MQTT_PASS" > passwd_plain
mosquitto_passwd -U passwd_plain 2>/dev/null || {
    # If mosquitto_passwd not available, create hash manually
    HASH=$(echo -n "$MQTT_PASS" | openssl dgst -sha256 -binary | openssl base64)
    echo "ruuvi:\$6\$$HASH" > passwd_plain
}

cd "$PROJECT_DIR"

echo "📦 Creating and populating Docker volumes..."

# Create volumes if they don't exist and copy files
docker volume create ruuvi-home-lite_mosquitto_certs >/dev/null 2>&1 || true
docker volume create ruuvi-home-lite_mosquitto_ca >/dev/null 2>&1 || true
docker volume create ruuvi-home-lite_mosquitto_passwd >/dev/null 2>&1 || true
docker volume create ruuvi-home-lite_mosquitto_data >/dev/null 2>&1 || true
docker volume create ruuvi-home-lite_mosquitto_logs >/dev/null 2>&1 || true
docker volume create ruuvi-home-lite_mosquitto_run >/dev/null 2>&1 || true

# Use a temporary container to populate volumes
echo "📂 Populating certificate volumes..."
docker run --rm -v ruuvi-home-lite_mosquitto_certs:/certs -v "$CERT_TEMP":/source alpine:latest sh -c "
    cp /source/server.crt /certs/
    cp /source/server.key /certs/
    chmod 644 /certs/server.crt
    chmod 600 /certs/server.key
    chown 1883:1883 /certs/*
"

docker run --rm -v ruuvi-home-lite_mosquitto_ca:/ca -v "$CERT_TEMP":/source alpine:latest sh -c "
    cp /source/ca.crt /ca/
    chmod 644 /ca/ca.crt
    chown 1883:1883 /ca/*
"

docker run --rm -v ruuvi-home-lite_mosquitto_passwd:/passwd -v "$CERT_TEMP":/source alpine:latest sh -c "
    cp /source/passwd_plain /passwd/passwd
    chmod 600 /passwd/passwd
    chown 1883:1883 /passwd/*
"

# Create run directory with proper permissions
docker run --rm -v ruuvi-home-lite_mosquitto_run:/run alpine:latest sh -c "
    chown 1883:1883 /run
    chmod 755 /run
"

# Create data and logs directories with proper permissions
docker run --rm -v ruuvi-home-lite_mosquitto_data:/data alpine:latest sh -c "
    chown 1883:1883 /data
    chmod 755 /data
"

docker run --rm -v ruuvi-home-lite_mosquitto_logs:/logs alpine:latest sh -c "
    chown 1883:1883 /logs
    chmod 755 /logs
"

# Copy the working mosquitto config
cp "$CERT_TEMP/mosquitto.conf" config/mosquitto-docker.conf

# Cleanup
rm -rf "$CERT_TEMP"

echo "✅ Docker volumes initialized successfully!"
echo ""
echo "📋 Volumes created:"
echo "   - mosquitto_certs (server certificates)"
echo "   - mosquitto_ca (CA certificate)"
echo "   - mosquitto_passwd (MQTT passwords)"
echo "   - mosquitto_data (persistent data)"
echo "   - mosquitto_logs (log files)"
echo "   - mosquitto_run (runtime files)"
echo ""
echo "🚀 Ready to start Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "🔑 MQTT Credentials:"
echo "   Server: $SERVER_IP:8883"
echo "   Username: ruuvi"
echo "   Password: $MQTT_PASS"