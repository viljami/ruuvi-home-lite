#!/bin/bash
set -e

echo "🛠️  Ruuvi Home Lite - Script Launcher"
echo "====================================="
echo ""

# Function to display menu
show_menu() {
    echo "Available scripts:"
    echo ""
    echo "📦 SETUP SCRIPTS:"
    echo "  1) setup.sh              - Complete native installation (Raspberry Pi)"
    echo "  2) setup-docker.sh       - Environment setup for Docker deployment"
    echo ""
    echo "🔧 MAINTENANCE SCRIPTS:"
    echo "  3) cleanup.sh            - Interactive cleanup and removal"
    echo "  4) remove.sh             - Quick complete removal"
    echo ""
    echo "🔍 TROUBLESHOOTING SCRIPTS:"
    echo "  5) fix-certificates.sh   - Fix TLS certificate issues"
    echo "  6) troubleshoot-mosquitto.sh - MQTT broker diagnostics"
    echo ""
    echo "📚 DOCUMENTATION:"
    echo "  7) View scripts/README.md - Detailed script documentation"
    echo "  8) View SETUP_GUIDE.md   - Complete setup guide"
    echo ""
    echo "  0) Exit"
    echo ""
}

# Function to run script safely
run_script() {
    local script_path="$1"
    local script_name="$2"
    
    if [ ! -f "$script_path" ]; then
        echo "❌ Script not found: $script_path"
        return 1
    fi
    
    echo "🚀 Running $script_name..."
    echo "=========================================="
    chmod +x "$script_path"
    
    if "$script_path"; then
        echo ""
        echo "✅ $script_name completed successfully"
    else
        echo ""
        echo "❌ $script_name failed with exit code $?"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
}

# Function to view documentation
view_doc() {
    local doc_path="$1"
    local doc_name="$2"
    
    if [ ! -f "$doc_path" ]; then
        echo "❌ Documentation not found: $doc_path"
        return 1
    fi
    
    echo "📖 Viewing $doc_name..."
    echo "=========================================="
    
    if command -v less >/dev/null 2>&1; then
        less "$doc_path"
    elif command -v more >/dev/null 2>&1; then
        more "$doc_path"
    else
        cat "$doc_path"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
}

# Check if scripts directory exists
if [ ! -d "scripts" ]; then
    echo "❌ Scripts directory not found!"
    echo "Please run this script from the ruuvi-home-lite root directory."
    exit 1
fi

# Main menu loop
while true; do
    show_menu
    read -p "Select an option [0-8]: " choice
    echo ""
    
    case $choice in
        1)
            run_script "./setup.sh" "Native Setup"
            ;;
        2)
            run_script "./setup-docker.sh" "Docker Setup"
            ;;
        3)
            run_script "scripts/cleanup.sh" "Interactive Cleanup"
            ;;
        4)
            run_script "scripts/remove.sh" "Quick Removal"
            ;;
        5)
            run_script "scripts/fix-certificates.sh" "Certificate Fix"
            ;;
        6)
            run_script "scripts/troubleshoot-mosquitto.sh" "MQTT Troubleshooting"
            ;;
        7)
            view_doc "scripts/README.md" "Scripts Documentation"
            ;;
        8)
            view_doc "SETUP_GUIDE.md" "Setup Guide"
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option: $choice"
            echo "Please select a number between 0 and 8."
            echo ""
            read -p "Press Enter to continue..."
            echo ""
            ;;
    esac
done