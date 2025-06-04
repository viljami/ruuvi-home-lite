#!/bin/bash
# Shared environment variable setup functions
# This script is meant to be sourced by other setup scripts

# Function to detect local IP address
detect_local_ip() {
    local ip_candidates=()

    # Get all IPv4 addresses, excluding loopback and docker interfaces
    while IFS= read -r line; do
        if [[ $line =~ inet[[:space:]]+([0-9.]+) ]]; then
            local ip="${BASH_REMATCH[1]}"
            local interface=$(echo "$line" | awk '{print $NF}')

            # Skip loopback and virtual interfaces
            if [[ $ip != "127."* && $interface != docker* && $interface != br-* && $interface != veth* ]]; then
                # Prioritize common local network ranges
                if [[ $ip =~ ^192\.168\. ]]; then
                    ip_candidates=("$ip" "${ip_candidates[@]}")  # Prepend (highest priority)
                elif [[ $ip =~ ^10\. ]] || [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]; then
                    ip_candidates+=("$ip")  # Append (lower priority)
                fi
            fi
        fi
    done < <(ip addr show 2>/dev/null || ifconfig 2>/dev/null)

    # Return the best candidate or fallback
    if [ ${#ip_candidates[@]} -gt 0 ]; then
        echo "${ip_candidates[0]}"
    else
        # Fallback to hostname -I if our detection fails
        hostname -I | awk '{print $1}'
    fi
}

# Function to generate secure MQTT password
generate_mqtt_password() {
    local password
    password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16 | tr -d '\n')
    
    if [ ${#password} -ne 16 ]; then
        echo "ERROR: Failed to generate secure password" >&2
        return 1
    fi
    
    echo "$password"
}

# Function to validate IP address format
validate_ip_address() {
    local ip="$1"
    if [[ ! $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 1
    fi
    
    # Check each octet is 0-255
    IFS='.' read -ra ADDR <<< "$ip"
    for i in "${ADDR[@]}"; do
        if [[ $i -lt 0 || $i -gt 255 ]]; then
            return 1
        fi
    done
    return 0
}

# Function to create or update .env file
create_or_update_env_file() {
    local mqtt_password="$1"
    local server_ip="$2"
    local env_file="${3:-.env}"
    local deployment_type="${4:-native}"  # native or docker
    
    # Validate inputs
    if [ -z "$mqtt_password" ] || [ -z "$server_ip" ]; then
        echo "ERROR: Missing required parameters for env file creation" >&2
        return 1
    fi
    
    if ! validate_ip_address "$server_ip"; then
        echo "ERROR: Invalid IP address format: $server_ip" >&2
        return 1
    fi
    
    # Create backup if file exists
    if [ -f "$env_file" ]; then
        cp "$env_file" "$env_file.backup.$(date +%s)"
    fi
    
    # Create new .env file
    cat > "$env_file" << EOF
# Environment Configuration - Generated $(date)
# DO NOT commit this file to version control

# MQTT Broker Configuration
MQTT_HOST=localhost
MQTT_PORT=8883
MQTT_USER=ruuvi
MQTT_PASS=$mqtt_password

# Server Configuration
NODE_ENV=production
SERVER_IP=$server_ip

# Optional: Custom database path
# DB_PATH=ruuvi.db

# Optional: Custom server port
# SERVER_PORT=3000

# Deployment type: native or docker
DEPLOYMENT_TYPE=$deployment_type
EOF

    # Set secure permissions
    chmod 600 "$env_file"
    
    return 0
}

# Function to update specific environment variable
update_env_var() {
    local env_file="$1"
    local var_name="$2"
    local var_value="$3"
    
    if [ ! -f "$env_file" ]; then
        echo "ERROR: Environment file $env_file not found" >&2
        return 1
    fi
    
    # Create backup
    cp "$env_file" "$env_file.tmp"
    
    # Update or add the variable
    if grep -q "^${var_name}=" "$env_file.tmp"; then
        sed -i "s/^${var_name}=.*/${var_name}=${var_value}/" "$env_file.tmp"
    else
        echo "${var_name}=${var_value}" >> "$env_file.tmp"
    fi
    
    # Atomically replace the file
    mv "$env_file.tmp" "$env_file"
    chmod 600 "$env_file"
    
    return 0
}

# Function to validate environment variables
validate_env_vars() {
    local env_file="${1:-.env}"
    
    if [ ! -f "$env_file" ]; then
        echo "ERROR: Environment file $env_file not found" >&2
        return 1
    fi
    
    # Source the env file
    source "$env_file"
    
    local errors=0
    
    # Check required variables
    if [ -z "$MQTT_HOST" ]; then
        echo "ERROR: MQTT_HOST not set" >&2
        ((errors++))
    fi
    
    if [ -z "$MQTT_PORT" ] || ! [[ "$MQTT_PORT" =~ ^[0-9]+$ ]]; then
        echo "ERROR: MQTT_PORT not set or invalid" >&2
        ((errors++))
    fi
    
    if [ -z "$MQTT_USER" ]; then
        echo "ERROR: MQTT_USER not set" >&2
        ((errors++))
    fi
    
    if [ -z "$MQTT_PASS" ] || [ "$MQTT_PASS" = "GENERATED_DURING_SETUP" ]; then
        echo "ERROR: MQTT_PASS not properly generated" >&2
        ((errors++))
    fi
    
    if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" = "DETECTED_DURING_SETUP" ]; then
        echo "ERROR: SERVER_IP not properly detected" >&2
        ((errors++))
    fi
    
    if ! validate_ip_address "$SERVER_IP"; then
        echo "ERROR: SERVER_IP has invalid format: $SERVER_IP" >&2
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        echo "✅ Environment variables validation passed"
        return 0
    else
        echo "❌ Environment variables validation failed with $errors errors"
        return 1
    fi
}

# Function to setup environment for Docker deployment
setup_docker_env() {
    local env_file="${1:-.env.docker}"
    
    echo "🔧 Setting up Docker environment variables..."
    
    # Generate password
    local mqtt_password
    mqtt_password=$(generate_mqtt_password)
    if [ $? -ne 0 ]; then
        echo "❌ Failed to generate MQTT password"
        return 1
    fi
    
    # For Docker, we can use 0.0.0.0 or detect host IP
    local server_ip
    server_ip=$(detect_local_ip)
    if [ $? -ne 0 ] || ! validate_ip_address "$server_ip"; then
        echo "⚠️  Could not detect valid IP, using 0.0.0.0 for Docker"
        server_ip="0.0.0.0"
    fi
    
    # Create Docker environment file
    if create_or_update_env_file "$mqtt_password" "$server_ip" "$env_file" "docker"; then
        echo "✅ Docker environment file created: $env_file"
        echo "🔑 MQTT Password: $mqtt_password"
        echo "🌐 Server IP: $server_ip"
        return 0
    else
        echo "❌ Failed to create Docker environment file"
        return 1
    fi
}

# Function to setup environment for native deployment
setup_native_env() {
    local env_file="${1:-.env}"
    
    echo "🔧 Setting up native environment variables..."
    
    # Generate password
    local mqtt_password
    mqtt_password=$(generate_mqtt_password)
    if [ $? -ne 0 ]; then
        echo "❌ Failed to generate MQTT password"
        return 1
    fi
    
    # Detect local IP
    local server_ip
    server_ip=$(detect_local_ip)
    if [ $? -ne 0 ] || ! validate_ip_address "$server_ip"; then
        echo "❌ Failed to detect valid local IP address: $server_ip"
        return 1
    fi
    
    # Create native environment file
    if create_or_update_env_file "$mqtt_password" "$server_ip" "$env_file" "native"; then
        echo "✅ Native environment file created: $env_file"
        echo "🔑 MQTT Password: $mqtt_password"
        echo "🌐 Server IP: $server_ip"
        
        # Add password to bashrc for manual reference
        echo "export MQTT_PASS='$mqtt_password'" >> ~/.bashrc
        
        return 0
    else
        echo "❌ Failed to create native environment file"
        return 1
    fi
}

# Function to display environment info
display_env_info() {
    local env_file="${1:-.env}"
    
    if [ ! -f "$env_file" ]; then
        echo "❌ Environment file $env_file not found"
        return 1
    fi
    
    source "$env_file"
    
    echo ""
    echo "📋 Environment Configuration:"
    echo "=============================="
    echo "MQTT Broker: ${MQTT_HOST}:${MQTT_PORT}"
    echo "MQTT User: ${MQTT_USER}"
    echo "MQTT Password: ${MQTT_PASS}"
    echo "Server IP: ${SERVER_IP}"
    echo "Environment: ${NODE_ENV}"
    echo "Deployment: ${DEPLOYMENT_TYPE:-native}"
    echo ""
}

# Export functions for use in other scripts
export -f detect_local_ip
export -f generate_mqtt_password
export -f validate_ip_address
export -f create_or_update_env_file
export -f update_env_var
export -f validate_env_vars
export -f setup_docker_env
export -f setup_native_env
export -f display_env_info