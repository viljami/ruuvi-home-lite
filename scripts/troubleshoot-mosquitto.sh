#!/bin/bash
set -e

echo "🔍 Mosquitto Troubleshooting Script"
echo "=================================="

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Running as root. Some commands will be executed with sudo."
    fi
}

# Function to check service status
check_service_status() {
    echo "📊 Checking Mosquitto service status..."
    systemctl is-active mosquitto || echo "❌ Service is not active"
    systemctl is-enabled mosquitto || echo "❌ Service is not enabled"
    
    echo ""
    echo "📋 Service status details:"
    systemctl status mosquitto --no-pager -l || true
}

# Function to check recent logs
check_logs() {
    echo ""
    echo "📖 Recent Mosquitto logs:"
    echo "========================"
    journalctl -u mosquitto --no-pager -n 20 || echo "❌ Could not retrieve logs"
}

# Function to validate configuration file
check_config() {
    echo ""
    echo "⚙️  Checking configuration file..."
    
    if [ ! -f /etc/mosquitto/mosquitto.conf ]; then
        echo "❌ Configuration file not found: /etc/mosquitto/mosquitto.conf"
        return 1
    fi
    
    echo "✅ Configuration file exists"
    
    # Test configuration syntax
    echo "🔍 Testing configuration syntax..."
    if mosquitto -c /etc/mosquitto/mosquitto.conf -v 2>/dev/null; then
        echo "✅ Configuration syntax is valid"
    else
        echo "❌ Configuration syntax error detected"
        echo "Running syntax check:"
        mosquitto -c /etc/mosquitto/mosquitto.conf -v
        return 1
    fi
}

# Function to check certificates
check_certificates() {
    echo ""
    echo "🔐 Checking TLS certificates..."
    
    local cert_dir="/etc/mosquitto/certs"
    local ca_dir="/etc/mosquitto/ca_certificates"
    
    # Check certificate files exist
    if [ ! -f "$cert_dir/server.crt" ]; then
        echo "❌ Server certificate not found: $cert_dir/server.crt"
        return 1
    fi
    
    if [ ! -f "$cert_dir/server.key" ]; then
        echo "❌ Server private key not found: $cert_dir/server.key"
        return 1
    fi
    
    if [ ! -f "$ca_dir/ca.crt" ]; then
        echo "❌ CA certificate not found: $ca_dir/ca.crt"
        return 1
    fi
    
    echo "✅ Certificate files exist"
    
    # Check certificate validity
    echo "🔍 Checking certificate validity..."
    if openssl x509 -in "$cert_dir/server.crt" -noout -checkend 86400 2>/dev/null; then
        echo "✅ Server certificate is valid"
    else
        echo "❌ Server certificate is invalid or expired"
        openssl x509 -in "$cert_dir/server.crt" -noout -dates
        return 1
    fi
    
    # Check certificate permissions
    echo "🔍 Checking certificate permissions..."
    local server_key_perms=$(stat -c %a "$cert_dir/server.key" 2>/dev/null || echo "000")
    if [ "$server_key_perms" != "600" ]; then
        echo "❌ Server key has incorrect permissions: $server_key_perms (should be 600)"
        echo "💡 Fix: sudo chmod 600 $cert_dir/server.key"
        return 1
    fi
    
    local server_key_owner=$(stat -c %U:%G "$cert_dir/server.key" 2>/dev/null || echo "unknown")
    if [ "$server_key_owner" != "mosquitto:mosquitto" ]; then
        echo "❌ Server key has incorrect ownership: $server_key_owner (should be mosquitto:mosquitto)"
        echo "💡 Fix: sudo chown mosquitto:mosquitto $cert_dir/server.key"
        return 1
    fi
    
    echo "✅ Certificate permissions are correct"
}

# Function to check password file
check_password_file() {
    echo ""
    echo "🔑 Checking password file..."
    
    if [ ! -f /etc/mosquitto/passwd ]; then
        echo "❌ Password file not found: /etc/mosquitto/passwd"
        echo "💡 Fix: Run setup script to regenerate password file"
        return 1
    fi
    
    echo "✅ Password file exists"
    
    # Check password file permissions
    local passwd_perms=$(stat -c %a /etc/mosquitto/passwd 2>/dev/null || echo "000")
    if [ "$passwd_perms" != "600" ]; then
        echo "❌ Password file has incorrect permissions: $passwd_perms (should be 600)"
        echo "💡 Fix: sudo chmod 600 /etc/mosquitto/passwd"
        return 1
    fi
    
    local passwd_owner=$(stat -c %U:%G /etc/mosquitto/passwd 2>/dev/null || echo "unknown")
    if [ "$passwd_owner" != "mosquitto:mosquitto" ]; then
        echo "❌ Password file has incorrect ownership: $passwd_owner (should be mosquitto:mosquitto)"
        echo "💡 Fix: sudo chown mosquitto:mosquitto /etc/mosquitto/passwd"
        return 1
    fi
    
    echo "✅ Password file permissions are correct"
    
    # Check if password file has content
    if [ ! -s /etc/mosquitto/passwd ]; then
        echo "❌ Password file is empty"
        echo "💡 Fix: Run setup script to regenerate passwords"
        return 1
    fi
    
    echo "✅ Password file contains data"
}

# Function to check ACL file
check_acl_file() {
    echo ""
    echo "🛡️  Checking ACL file..."
    
    if [ ! -f /etc/mosquitto/acl ]; then
        echo "❌ ACL file not found: /etc/mosquitto/acl"
        echo "💡 Fix: Copy config/acl to /etc/mosquitto/acl"
        return 1
    fi
    
    echo "✅ ACL file exists"
    
    # Check ACL file permissions
    local acl_owner=$(stat -c %U:%G /etc/mosquitto/acl 2>/dev/null || echo "unknown")
    if [ "$acl_owner" != "mosquitto:mosquitto" ]; then
        echo "❌ ACL file has incorrect ownership: $acl_owner (should be mosquitto:mosquitto)"
        echo "💡 Fix: sudo chown mosquitto:mosquitto /etc/mosquitto/acl"
        return 1
    fi
    
    echo "✅ ACL file permissions are correct"
}

# Function to check directories
check_directories() {
    echo ""
    echo "📁 Checking required directories..."
    
    local dirs=(
        "/var/lib/mosquitto"
        "/var/log/mosquitto"
        "/etc/mosquitto/certs"
        "/etc/mosquitto/ca_certificates"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "❌ Directory missing: $dir"
            echo "💡 Fix: sudo mkdir -p $dir && sudo chown mosquitto:mosquitto $dir"
            return 1
        else
            echo "✅ Directory exists: $dir"
        fi
    done
}

# Function to check ports
check_ports() {
    echo ""
    echo "🌐 Checking port availability..."
    
    if ss -ln | grep -q ":8883 "; then
        echo "❌ Port 8883 is already in use"
        echo "🔍 Process using port 8883:"
        ss -tlnp | grep ":8883"
        return 1
    else
        echo "✅ Port 8883 is available"
    fi
}

# Function to check mosquitto user
check_mosquitto_user() {
    echo ""
    echo "👤 Checking mosquitto user..."
    
    if ! id mosquitto >/dev/null 2>&1; then
        echo "❌ Mosquitto user does not exist"
        echo "💡 Fix: sudo useradd -r -M -d /var/lib/mosquitto -s /usr/sbin/nologin mosquitto"
        return 1
    else
        echo "✅ Mosquitto user exists"
    fi
}

# Function to provide common fixes
provide_fixes() {
    echo ""
    echo "🔧 Common Fixes:"
    echo "==============="
    echo ""
    echo "1. Regenerate certificates and passwords:"
    echo "   ./setup.sh"
    echo ""
    echo "2. Fix ownership and permissions:"
    echo "   sudo chown -R mosquitto:mosquitto /etc/mosquitto/"
    echo "   sudo chown -R mosquitto:mosquitto /var/lib/mosquitto/"
    echo "   sudo chown -R mosquitto:mosquitto /var/log/mosquitto/"
    echo "   sudo chmod 600 /etc/mosquitto/certs/server.key"
    echo "   sudo chmod 600 /etc/mosquitto/passwd"
    echo ""
    echo "3. Restart service:"
    echo "   sudo systemctl stop mosquitto"
    echo "   sudo systemctl start mosquitto"
    echo ""
    echo "4. Check configuration manually:"
    echo "   mosquitto -c /etc/mosquitto/mosquitto.conf -v"
    echo ""
    echo "5. Reset systemd failure state:"
    echo "   sudo systemctl reset-failed mosquitto"
    echo ""
    echo "6. If all else fails, reinstall Mosquitto:"
    echo "   sudo apt remove --purge mosquitto mosquitto-clients"
    echo "   sudo apt autoremove"
    echo "   sudo apt install mosquitto mosquitto-clients"
    echo "   ./setup.sh"
}

# Function to attempt automatic fixes
auto_fix() {
    echo ""
    echo "🔄 Attempting automatic fixes..."
    echo "==============================="
    
    # Stop the service first
    echo "🛑 Stopping Mosquitto service..."
    sudo systemctl stop mosquitto || true
    
    # Reset systemd failure state
    echo "🔄 Resetting systemd failure state..."
    sudo systemctl reset-failed mosquitto || true
    
    # Fix directory ownership
    echo "📁 Fixing directory ownership..."
    sudo chown -R mosquitto:mosquitto /etc/mosquitto/ || true
    sudo chown -R mosquitto:mosquitto /var/lib/mosquitto/ || true
    sudo chown -R mosquitto:mosquitto /var/log/mosquitto/ || true
    
    # Fix file permissions
    echo "🔐 Fixing file permissions..."
    if [ -f /etc/mosquitto/certs/server.key ]; then
        sudo chmod 600 /etc/mosquitto/certs/server.key
    fi
    if [ -f /etc/mosquitto/passwd ]; then
        sudo chmod 600 /etc/mosquitto/passwd
    fi
    
    # Test configuration
    echo "⚙️  Testing configuration..."
    if mosquitto -c /etc/mosquitto/mosquitto.conf -v; then
        echo "✅ Configuration test passed"
    else
        echo "❌ Configuration test failed"
        return 1
    fi
    
    # Start the service
    echo "🚀 Starting Mosquitto service..."
    if sudo systemctl start mosquitto; then
        echo "✅ Service started successfully"
        return 0
    else
        echo "❌ Service failed to start"
        return 1
    fi
}

# Main execution
main() {
    check_root
    echo ""
    
    # Run all checks
    local checks_passed=0
    
    check_service_status
    check_logs
    
    if check_config; then ((checks_passed++)); fi
    if check_certificates; then ((checks_passed++)); fi
    if check_password_file; then ((checks_passed++)); fi
    if check_acl_file; then ((checks_passed++)); fi
    if check_directories; then ((checks_passed++)); fi
    if check_ports; then ((checks_passed++)); fi
    if check_mosquitto_user; then ((checks_passed++)); fi
    
    echo ""
    echo "📊 Check Results: $checks_passed/7 passed"
    
    if [ $checks_passed -eq 7 ]; then
        echo "✅ All checks passed. The issue might be transient."
        echo "🔄 Try restarting the service: sudo systemctl restart mosquitto"
    else
        echo "❌ Some checks failed."
        
        # Ask if user wants automatic fixes
        echo ""
        read -p "🤔 Would you like to attempt automatic fixes? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if auto_fix; then
                echo "✅ Automatic fixes completed successfully"
                echo "🔍 Checking service status..."
                systemctl status mosquitto --no-pager -l
            else
                echo "❌ Automatic fixes failed"
                provide_fixes
            fi
        else
            provide_fixes
        fi
    fi
}

# Run main function
main "$@"