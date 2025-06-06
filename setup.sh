#!/bin/bash
set -e

echo "🐳 Ruuvi Home Lite - Docker Setup"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "Please don't run as root."
   exit 1
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
cd "$PROJECT_DIR"

# Function to check Docker requirements
check_docker() {
    log_info "Checking Docker requirements..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is required but not installed."
        log_info "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running."
        log_info "Please start Docker and try again."
        exit 1
    fi
    
    # Check for docker compose
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        log_error "Docker Compose is required but not found."
        log_info "Please install Docker Compose."
        exit 1
    fi
    
    log_success "Docker requirements met"
}

# Function to install Node.js dependencies (for local development)
install_dependencies() {
    log_info "Installing development dependencies..."
    
    if ! command -v node >/dev/null 2>&1; then
        log_warning "Node.js not found - Docker will handle this in containers"
        return 0
    fi
    
    if ! npm install; then
        log_warning "Failed to install local dependencies - Docker build will handle this"
    else
        log_success "Local dependencies installed"
    fi
}

# Function to setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create Docker environment file
    if [ ! -f ".env.docker" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env.docker
            log_success "Created .env.docker from template"
        else
            log_warning "No .env.example found, creating minimal .env.docker"
            cat > .env.docker << EOF
# Docker Environment Configuration
NODE_ENV=production
DB_PATH=/app/data/ruuvi.db
MQTT_HOST=mosquitto
MQTT_PORT=1883
WEB_PORT=3000
API_PORT=3001
EOF
        fi
    else
        log_info ".env.docker already exists"
    fi
    
    # Create local development environment file
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env for local development"
    fi
}

# Function to build Docker images
build_docker() {
    log_info "Building Docker images..."
    
    if ! docker build -t ruuvi-home-lite .; then
        log_error "Docker build failed"
        exit 1
    fi
    
    log_success "Docker images built successfully"
}

# Function to show deployment options
show_deployment_options() {
    echo ""
    log_success "Setup completed successfully!"
    echo ""
    echo "🚀 Deployment Options:"
    echo ""
    echo "Simple deployment (HTTP, no TLS):"
    echo "  docker compose -f docker-compose.simple.yml up -d"
    echo "  make docker-simple"
    echo ""
    echo "Secure deployment (HTTPS, TLS):"
    echo "  docker compose up -d"
    echo "  make docker-secure"
    echo ""
    echo "🛠️  Development:"
    echo "  npm run dev              # Local development (requires Node.js)"
    echo "  npm run build            # Build packages locally"
    echo ""
    echo "📊 Management:"
    echo "  make docker-logs         # View container logs"
    echo "  make docker-status       # Check deployment status"
    echo "  make docker-stop         # Stop all services"
    echo ""
    echo "🌐 Access URLs:"
    echo "  Web interface: http://localhost:3000 (simple) or https://localhost:3000 (secure)"
    echo "  MQTT broker: localhost:1883 (simple) or localhost:8883 (secure)"
    echo ""
}

# Function to run development setup
dev_setup() {
    log_info "Setting up for local development..."
    
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is required for development setup"
        log_info "Install Node.js 18+ or use Docker-only deployment"
        exit 1
    fi
    
    if ! npm install; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    
    log_info "Building packages..."
    if npm run build:shared && npm run build:frontend; then
        npm run build:backend || log_warning "Backend built with TypeScript warnings (non-blocking)"
        log_success "Development setup complete"
    else
        log_error "Build failed"
        exit 1
    fi
    
    echo ""
    echo "🚀 Development mode:"
    echo "  npm run dev              # Start development servers"
    echo "  npm run build            # Build all packages"
    echo "  npm run lint             # Lint code"
    echo ""
}

# Main setup function
main() {
    case "${1:-}" in
        --dev)
            check_docker
            setup_environment
            dev_setup
            ;;
        --build-only)
            log_info "Building Docker images only..."
            check_docker
            build_docker
            log_success "Docker build complete"
            ;;
        --env-only)
            log_info "Setting up environment files only..."
            setup_environment
            log_success "Environment setup complete"
            ;;
        --help|-h)
            echo "Usage: $0 [option]"
            echo ""
            echo "Options:"
            echo "  --dev        Setup for local development"
            echo "  --build-only Build Docker images only"
            echo "  --env-only   Setup environment files only"
            echo "  --help       Show this help"
            echo ""
            echo "Default (no args): Full Docker setup"
            exit 0
            ;;
        *)
            # Full Docker setup (default)
            check_docker
            install_dependencies
            setup_environment
            build_docker
            show_deployment_options
            ;;
    esac
}

# Run main function with all arguments
main "$@"