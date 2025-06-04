#!/bin/bash
# Wrapper script for Docker setup
# Calls the actual Docker setup script in the scripts directory

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if the actual setup script exists
ACTUAL_SETUP="$SCRIPT_DIR/scripts/setup-docker.sh"

if [ ! -f "$ACTUAL_SETUP" ]; then
    echo "❌ Docker setup script not found at: $ACTUAL_SETUP"
    echo "Please ensure the scripts directory contains setup-docker.sh"
    exit 1
fi

# Make sure the script is executable
chmod +x "$ACTUAL_SETUP"

# Call the actual setup script with all arguments
exec "$ACTUAL_SETUP" "$@"