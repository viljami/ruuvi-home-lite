#!/bin/bash
set -e

echo "🐳 Ruuvi Home Lite - Quick Docker Start"
echo "======================================"

# Function to detect the correct Docker Compose command
detect_docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        echo "ERROR: Neither 'docker-compose' nor 'docker compose' found" >&2
        echo "Please install Docker Compose:" >&2
        echo "  - Standalone: https://docs.docker.com/compose/install/" >&2
        echo "  - Plugin: docker plugin install compose" >&2
        exit 1
    fi
}

# Function to clean up existing containers and volumes
cleanup() {
    echo "🧹 Cleaning up existing containers and volumes..."
    
    # Detect Docker Compose command
    local compose_cmd=$(detect_docker_compose)
    
    # Stop all compose services
    $compose_cmd down -v 2>/dev/null || true
    $compose_cmd -f docker-compose.simple.yml down -v 2>/dev/null || true
    
    # Remove any orphaned ruuvi volumes
    docker volume ls -q | grep ruuvi | xargs -r docker volume rm 2>/dev/null || true
    
    # Remove any stopped ruuvi containers
    docker ps -a -q --filter "name=ruuvi" | xargs -r docker rm 2>/dev/null || true
    
    echo "✅ Cleanup completed"
}

# Function to start simple deployment
start_simple() {
    echo "🚀 Starting simple Docker deployment..."
    
    # Detect Docker Compose command
    local compose_cmd=$(detect_docker_compose)
    echo "🐳 Using: $compose_cmd"
    
    if $compose_cmd -f docker-compose.simple.yml up --build -d; then
        echo "✅ Containers started successfully"
        
        # Wait for services to be ready
        echo "⏳ Waiting for services to start..."
        sleep 10
        
        # Check status
        echo "📊 Container status:"
        $compose_cmd -f docker-compose.simple.yml ps
        
        # Get local IP
        LOCAL_IP=$(hostname -I | awk '{print $1}' | head -1)
        
        echo ""
        echo "🎉 Deployment successful!"
        echo "=========================="
        echo "🌐 Web Interface: http://$LOCAL_IP:3000"
        echo "📡 MQTT Broker: $LOCAL_IP:1883 (no authentication)"
        echo ""
        echo "🔧 Configure your Ruuvi Gateway:"
        echo "   Server: $LOCAL_IP:1883"
        echo "   Protocol: MQTT (insecure)"
        echo "   Username: (leave empty)"
        echo "   Password: (leave empty)"
        echo ""
        echo "📖 View logs: $compose_cmd -f docker-compose.simple.yml logs -f"
        echo "🛑 Stop: $compose_cmd -f docker-compose.simple.yml down"
    else
        echo "❌ Failed to start containers"
        echo "📖 Check logs: $compose_cmd -f docker-compose.simple.yml logs"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose (will exit if not found)
    local compose_cmd=$(detect_docker_compose)
    echo "🐳 Detected: $compose_cmd"
    
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon is not running. Please start Docker first."
        exit 1
    fi
}

# Function to test deployment
test_deployment() {
    echo "🔍 Testing deployment..."
    
    # Test web interface
    if curl -f -s -m 5 http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Web interface is accessible"
    else
        echo "⚠️  Web interface not ready yet (may take a few more seconds)"
    fi
    
    # Test MQTT broker
    if timeout 5 mosquitto_pub -h localhost -p 1883 -t test -m "test" >/dev/null 2>&1; then
        echo "✅ MQTT broker is accessible"
    else
        echo "ℹ️  MQTT broker test skipped (mosquitto-clients not installed)"
    fi
}

# Main execution
main() {
    check_prerequisites
    
    echo "This will:"
    echo "  1. Clean up any existing Ruuvi containers and volumes"
    echo "  2. Start a fresh simple deployment (HTTP, no TLS)"
    echo "  3. Test the deployment"
    echo ""
    
    read -p "Continue? [Y/n]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        cleanup
        start_simple
        test_deployment
    else
        echo "❌ Cancelled by user"
        exit 0
    fi
}

# Run main function
main "$@"