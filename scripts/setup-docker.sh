#!/bin/bash
set -e

echo "🐳 Ruuvi Home Lite - Docker Environment Setup"
echo "=============================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Please don't run as root."
   exit 1
fi

# Get script directory
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

echo "🔍 Setting up Docker environment variables..."

# Setup environment for Docker
if ! setup_docker_env ".env.docker"; then
    echo "❌ Failed to setup Docker environment"
    exit 1
fi

# Also create a regular .env file for local development
if ! setup_docker_env ".env"; then
    echo "❌ Failed to setup local .env file"
    exit 1
fi

# Validate the environment
if ! validate_env_vars ".env.docker"; then
    echo "❌ Environment validation failed"
    exit 1
fi

# Initialize Docker volumes with certificates and passwords
echo "🐳 Initializing Docker volumes..."
if [ -f "$SCRIPT_DIR/docker-init.sh" ]; then
    chmod +x "$SCRIPT_DIR/docker-init.sh"
    "$SCRIPT_DIR/docker-init.sh"
else
    echo "⚠️  Docker initialization script not found, skipping volume setup"
    echo "💡 You may need to manually configure certificates and passwords"
fi

# Display configuration
display_env_info ".env.docker"

echo "✅ Docker environment setup complete!"
echo ""
echo "🐳 Next steps for Docker deployment:"
echo "===================================="
echo ""
echo "1. Build and start with Docker Compose:"
echo "   docker-compose up --build -d"
echo ""
echo "2. Or build Docker image manually:"
echo "   docker build -t ruuvi-home-lite ."
echo ""
echo "3. Check container logs:"
echo "   docker-compose logs -f"
echo ""
echo "4. Access dashboard:"
echo "   https://$(grep SERVER_IP .env.docker | cut -d'=' -f2):3000"
echo ""
echo "📋 Environment files created:"
echo "   ✅ .env.docker - Docker Compose environment"
echo "   ✅ .env - Local development environment"
echo ""
echo "🔑 MQTT Configuration for Gateway:"
echo "   Server: $(grep SERVER_IP .env.docker | cut -d'=' -f2):8883"
echo "   Username: ruuvi"
echo "   Password: $(grep MQTT_PASS .env.docker | cut -d'=' -f2)"
echo "   Protocol: MQTT over TLS"
echo ""
echo "⚠️  Important Security Notes:"
echo "   - Keep .env files secure and never commit to version control"
echo "   - Use self-signed certificates for local network only"
echo "   - Configure gateway to use the displayed MQTT settings"
echo ""
echo "🏁 Docker environment setup finished."