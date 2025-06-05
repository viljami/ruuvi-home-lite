#!/bin/bash
# Docker Compose detection and wrapper script
# Automatically detects whether to use 'docker-compose' or 'docker compose'

set -e

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

# Function to execute Docker Compose with detected command
docker_compose_exec() {
    local compose_cmd=$(detect_docker_compose)
    echo "🐳 Using: $compose_cmd" >&2
    exec $compose_cmd "$@"
}

# Export functions for use in other scripts
export -f detect_docker_compose
export -f docker_compose_exec

# If script is executed directly (not sourced), run the command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <docker-compose-arguments>"
        echo "Example: $0 up --build -d"
        echo "Example: $0 -f docker-compose.simple.yml logs -f"
        exit 1
    fi
    
    docker_compose_exec "$@"
fi