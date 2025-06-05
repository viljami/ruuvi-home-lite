#!/bin/bash
set -e

echo "🐳 Ruuvi Home Lite - Docker Deployment Script"
echo "=============================================="

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

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Detect Docker Compose command
DOCKER_COMPOSE=$(detect_docker_compose)
echo "🐳 Using: $DOCKER_COMPOSE"

# Function to show menu
show_menu() {
    echo ""
    echo "📋 Deployment Options:"
    echo "  1) Simple Deployment (HTTP, no TLS) - Recommended for testing"
    echo "  2) Secure Deployment (HTTPS, TLS) - Recommended for production"
    echo "  3) Stop All Services"
    echo "  4) View Logs"
    echo "  5) Clean Reset (removes all containers and volumes)"
    echo "  6) Status Check"
    echo "  0) Exit"
    echo ""
}

# Function to deploy simple version
deploy_simple() {
    echo "🚀 Starting Simple Deployment (HTTP, no TLS)..."
    
    # Stop any existing services
    $DOCKER_COMPOSE down 2>/dev/null || true
    $DOCKER_COMPOSE -f docker-compose.simple.yml down 2>/dev/null || true
    
    # Start simple deployment
    if $DOCKER_COMPOSE -f docker-compose.simple.yml up --build -d; then
        echo "✅ Simple deployment started successfully!"
        echo ""
        echo "📡 MQTT Broker: http://$(hostname -I | awk '{print $1}'):1883 (insecure)"
        echo "🌐 Web Interface: http://$(hostname -I | awk '{print $1}'):3000"
        echo ""
        echo "🔧 Configure your Ruuvi Gateway:"
        echo "   Server: $(hostname -I | awk '{print $1}'):1883"
        echo "   Protocol: MQTT (no TLS)"
        echo "   Username: (leave empty)"
        echo "   Password: (leave empty)"
        echo ""
        echo "💡 Check status with: $DOCKER_COMPOSE -f docker-compose.simple.yml ps"
    else
        echo "❌ Simple deployment failed. Check logs with option 4."
    fi
}

# Function to deploy secure version
deploy_secure() {
    echo "🔐 Starting Secure Deployment (HTTPS, TLS)..."
    
    # Stop simple deployment if running
    $DOCKER_COMPOSE -f docker-compose.simple.yml down 2>/dev/null || true
    
    # Setup environment if not exists
    if [ ! -f .env.docker ]; then
        echo "📝 Setting up environment variables..."
        if [ -f "./setup-docker.sh" ]; then
            ./setup-docker.sh
        else
            echo "❌ setup-docker.sh not found. Run from project root directory."
            return 1
        fi
    fi
    
    # Start secure deployment
    if $DOCKER_COMPOSE up --build -d; then
        echo "✅ Secure deployment started successfully!"
        echo ""
        echo "📡 MQTT Broker: https://$(hostname -I | awk '{print $1}'):8883 (TLS)"
        echo "🌐 Web Interface: https://$(hostname -I | awk '{print $1}'):3000"
        echo ""
        echo "🔧 Configure your Ruuvi Gateway:"
        echo "   Server: $(hostname -I | awk '{print $1}'):8883"
        echo "   Protocol: MQTT over TLS"
        echo "   Username: ruuvi"
        echo "   Password: $(grep MQTT_PASS .env.docker 2>/dev/null | cut -d'=' -f2 || echo 'Check .env.docker file')"
        echo ""
        echo "💡 Check status with: $DOCKER_COMPOSE ps"
    else
        echo "❌ Secure deployment failed. Try simple deployment first or check logs."
    fi
}

# Function to stop all services
stop_services() {
    echo "🛑 Stopping all services..."
    $DOCKER_COMPOSE down 2>/dev/null || true
    $DOCKER_COMPOSE -f docker-compose.simple.yml down 2>/dev/null || true
    echo "✅ All services stopped."
}

# Function to view logs
view_logs() {
    echo "📖 Available log options:"
    echo "  1) Simple deployment logs"
    echo "  2) Secure deployment logs"
    echo "  3) Mosquitto logs only"
    echo "  4) App logs only"
    echo ""
    read -p "Select option [1-4]: " log_choice
    
    case $log_choice in
        1)
            $DOCKER_COMPOSE -f docker-compose.simple.yml logs -f
            ;;
        2)
            $DOCKER_COMPOSE logs -f
            ;;
        3)
            if docker ps | grep -q ruuvi-mosquitto; then
                docker logs -f ruuvi-mosquitto
            elif docker ps | grep -q ruuvi-mosquitto-simple; then
                docker logs -f ruuvi-mosquitto-simple
            else
                echo "❌ No mosquitto container running"
            fi
            ;;
        4)
            if docker ps | grep -q ruuvi-home; then
                docker logs -f ruuvi-home
            elif docker ps | grep -q ruuvi-home-simple; then
                docker logs -f ruuvi-home-simple
            else
                echo "❌ No app container running"
            fi
            ;;
        *)
            echo "❌ Invalid option"
            ;;
    esac
}

# Function to clean reset
clean_reset() {
    echo "⚠️  WARNING: This will remove all containers, volumes, and data!"
    read -p "Type 'RESET' to confirm: " confirmation
    
    if [ "$confirmation" = "RESET" ]; then
        echo "🧹 Performing clean reset..."
        $DOCKER_COMPOSE down -v 2>/dev/null || true
        $DOCKER_COMPOSE -f docker-compose.simple.yml down -v 2>/dev/null || true
        docker system prune -af
        docker volume prune -f
        echo "✅ Clean reset completed. You can now start fresh."
    else
        echo "❌ Reset cancelled."
    fi
}

# Function to check status
check_status() {
    echo "📊 System Status:"
    echo "=================="
    
    echo ""
    echo "🐳 Docker Containers:"
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q ruuvi; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ruuvi
    else
        echo "No Ruuvi containers running"
    fi
    
    echo ""
    echo "📦 Docker Volumes:"
    docker volume ls | grep ruuvi || echo "No Ruuvi volumes found"
    
    echo ""
    echo "🌐 Network Connectivity:"
    if curl -f -s -m 5 http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ HTTP web interface accessible"
    elif curl -f -s -k -m 5 https://localhost:3000 >/dev/null 2>&1; then
        echo "✅ HTTPS web interface accessible"
    else
        echo "❌ Web interface not accessible"
    fi
    
    if timeout 5 mosquitto_pub -h localhost -p 1883 -t test -m test >/dev/null 2>&1; then
        echo "✅ MQTT broker (insecure) accessible"
    else
        echo "❌ MQTT broker (insecure) not accessible"
    fi
    
    echo ""
    echo "💾 Disk Usage:"
    docker system df
}

# Main menu loop
while true; do
    show_menu
    read -p "Select an option [0-6]: " choice
    
    case $choice in
        1)
            deploy_simple
            ;;
        2)
            deploy_secure
            ;;
        3)
            stop_services
            ;;
        4)
            view_logs
            ;;
        5)
            clean_reset
            ;;
        6)
            check_status
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option: $choice"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done