#!/bin/bash

# Nginx installation and configuration script for Ruuvi Home Lite
# This script sets up Nginx as a reverse proxy for ruuvi.koti.local

set -e  # Exit on any error

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

# Functions
print_section() {
    echo -e "\n${BOLD}${GREEN}==>${RESET}${BOLD} $1 ${RESET}"
}

print_info() {
    echo -e "${YELLOW}INFO:${RESET} $1"
}

print_error() {
    echo -e "${RED}ERROR:${RESET} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

# Get script directory
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

# Detect Raspberry Pi hostname and IP
HOSTNAME=$(hostname)
IP_ADDRESS=$(hostname -I | awk '{print $1}')

print_section "Setting up Nginx for Ruuvi Home Lite"
print_info "Host: $HOSTNAME ($IP_ADDRESS)"
print_info "Target subdomain: subdomain.local.network"

# Install Nginx if not already installed
print_section "Installing Nginx"
if command -v nginx >/dev/null 2>&1; then
    print_info "Nginx is already installed"
else
    apt update
    apt install -y nginx
    print_info "Nginx installed successfully"
fi

# Check Nginx status
if systemctl is-active --quiet nginx; then
    print_info "Nginx is running"
else
    print_info "Starting Nginx"
    systemctl start nginx
fi

# Configure Nginx
print_section "Configuring Nginx"

# Choose between HTTP and HTTPS
echo -e "\nWould you like to set up HTTPS with SSL? (y/n, default: y): "
read -r USE_HTTPS
USE_HTTPS=${USE_HTTPS:-y}

if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
    CONFIG_FILE="$SCRIPT_DIR/subdomain.local.network-https.conf"
    print_info "Using HTTPS configuration"
    
    # Set up SSL certificates
    print_section "Setting up SSL certificates"
    mkdir -p /etc/nginx/ssl
    
    # Check if certificates already exist
    if [ -f "/etc/nginx/ssl/subdomain.local.network.crt" ] && [ -f "/etc/nginx/ssl/subdomain.local.network.key" ]; then
        print_info "SSL certificates already exist"
        echo "Would you like to regenerate them? (y/n, default: n): "
        read -r REGEN_CERTS
        REGEN_CERTS=${REGEN_CERTS:-n}
        
        if [[ "$REGEN_CERTS" =~ ^[Yy]$ ]]; then
            rm -f /etc/nginx/ssl/subdomain.local.network.crt /etc/nginx/ssl/subdomain.local.network.key
        else
            print_info "Using existing certificates"
        fi
    fi
    
    # Generate certificates if they don't exist
    if [ ! -f "/etc/nginx/ssl/subdomain.local.network.crt" ] || [ ! -f "/etc/nginx/ssl/subdomain.local.network.key" ]; then
        print_info "Generating self-signed SSL certificates"
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/subdomain.local.network.key \
            -out /etc/nginx/ssl/subdomain.local.network.crt \
            -subj "/CN=subdomain.local.network" \
            -addext "subjectAltName = DNS:subdomain.local.network"
        chmod 600 /etc/nginx/ssl/subdomain.local.network.key
        print_info "SSL certificates generated (valid for 10 years)"
    fi
else
    CONFIG_FILE="$SCRIPT_DIR/subdomain.local.network.conf"
    print_info "Using HTTP configuration (no SSL)"
fi

# Ask for the target host
echo -e "\nEnter the host address of your Ruuvi application (default: your-ruuvi-host): "
read -r TARGET_HOST
TARGET_HOST=${TARGET_HOST:-your-ruuvi-host}

# Ask for the target port
echo -e "\nEnter the port of your Ruuvi application (default: 3000): "
read -r TARGET_PORT
TARGET_PORT=${TARGET_PORT:-3000}

# Check if the Ruuvi app is using HTTPS
echo -e "\nIs your Ruuvi application using HTTPS? (y/n, default: y): "
read -r TARGET_HTTPS
TARGET_HTTPS=${TARGET_HTTPS:-y}

# Copy and modify the configuration file
print_info "Setting up Nginx configuration"
cp "$CONFIG_FILE" /etc/nginx/sites-available/subdomain.local.network

# Replace target host and port in configuration
if [[ "$TARGET_HTTPS" =~ ^[Yy]$ ]]; then
    TARGET_PROTOCOL="https"
else
    TARGET_PROTOCOL="http"
fi

# Update the configuration file with the correct target
sed -i "s|proxy_pass [^;]*;|proxy_pass ${TARGET_PROTOCOL}://${TARGET_HOST}:${TARGET_PORT};|g" /etc/nginx/sites-available/subdomain.local.network

# Enable the site
if [ ! -L "/etc/nginx/sites-enabled/subdomain.local.network" ]; then
    ln -sf /etc/nginx/sites-available/subdomain.local.network /etc/nginx/sites-enabled/
    print_info "Site enabled"
else
    print_info "Site already enabled"
fi

# Test the configuration
print_section "Testing Nginx configuration"
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed. Please check the errors above."
    exit 1
fi

# Restart Nginx
print_section "Restarting Nginx"
systemctl restart nginx

# Enable Nginx to start on boot
systemctl enable nginx
print_info "Nginx enabled to start on boot"

# Add a reminder about local DNS setup
print_section "Next Steps: DNS Configuration"
echo -e "To access your Ruuvi application at ${BOLD}subdomain.local.network${RESET}, you need to:"
echo -e "1. Either configure your router's DNS settings to point subdomain.local.network to ${BOLD}$IP_ADDRESS${RESET}"
echo -e "2. Or add the following line to your hosts file on each client device:"
echo -e "   ${BOLD}$IP_ADDRESS subdomain.local.network${RESET}"
echo
echo -e "Location of hosts file:"
echo -e "- Linux/macOS: /etc/hosts"
echo -e "- Windows: C:\\Windows\\System32\\drivers\\etc\\hosts"

print_section "Installation Complete!"
if [[ "$USE_HTTPS" =~ ^[Yy]$ ]]; then
    echo -e "Your Ruuvi application should now be accessible at: ${BOLD}https://subdomain.local.network${RESET}"
else
    echo -e "Your Ruuvi application should now be accessible at: ${BOLD}http://subdomain.local.network${RESET}"
fi
echo -e "If you encounter any issues, check the Nginx logs with: ${BOLD}sudo tail -f /var/log/nginx/error.log${RESET}"