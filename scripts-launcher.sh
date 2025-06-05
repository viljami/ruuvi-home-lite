#!/bin/bash
set -e

echo "🛠️  Ruuvi Home Lite - Script Launcher"
echo "====================================="
echo ""

# Function to display menu
show_menu() {
    echo "Available operations:"
    echo ""
    echo "📦 SETUP & INSTALLATION:"
    echo "  1) Native Setup (Raspberry Pi)     - make setup"
    echo "  2) Docker Environment Setup        - make setup-docker"
    echo ""
    echo "🚀 DEPLOYMENT:"
    echo "  3) Start Native (Development)      - make dev"
    echo "  4) Start Native (Production)       - make start"
    echo "  5) Start Docker Simple             - make docker-simple"
    echo "  6) Start Docker Secure             - make docker-secure"
    echo ""
    echo "🔧 MAINTENANCE:"
    echo "  7) Stop Services                   - make stop / make docker-stop"
    echo "  8) View Logs                       - make logs / make docker-logs"
    echo "  9) Interactive Cleanup             - make cleanup"
    echo " 10) Status Check                    - make docker-status"
    echo ""
    echo "🔍 TROUBLESHOOTING:"
    echo " 11) Fix Certificates               - scripts/fix-certificates.sh"
    echo " 12) MQTT Diagnostics               - scripts/troubleshoot-mosquitto.sh"
    echo " 13) Docker Quick Start             - scripts/docker-quick-start.sh"
    echo ""
    echo "📚 DOCUMENTATION:"
    echo " 14) View README                    - View project documentation"
    echo " 15) View Scripts Help              - scripts/README.md"
    echo ""
    echo "  0) Exit"
    echo ""
}

# Function to run make target
run_make() {
    local target="$1"
    local description="$2"
    
    echo "🚀 Running: $description"
    echo "Command: make $target"
    echo "=========================================="
    
    if make "$target"; then
        echo ""
        echo "✅ $description completed successfully"
    else
        echo ""
        echo "❌ $description failed"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
}

# Function to run script
run_script() {
    local script_path="$1"
    local description="$2"
    
    if [ ! -f "$script_path" ]; then
        echo "❌ Script not found: $script_path"
        return 1
    fi
    
    echo "🚀 Running: $description"
    echo "Script: $script_path"
    echo "=========================================="
    chmod +x "$script_path"
    
    if "$script_path"; then
        echo ""
        echo "✅ $description completed successfully"
    else
        echo ""
        echo "❌ $description failed"
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
    
    echo "📖 Viewing: $doc_name"
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

# Check if we're in project root
if [ ! -f "Makefile" ] || [ ! -d "scripts" ]; then
    echo "❌ Please run this script from the ruuvi-home-lite root directory"
    echo "   (Makefile and scripts directory not found)"
    exit 1
fi

# Main menu loop
while true; do
    show_menu
    read -p "Select an option [0-15]: " choice
    echo ""
    
    case $choice in
        1)
            run_make "setup" "Native Setup"
            ;;
        2)
            run_make "setup-docker" "Docker Environment Setup"
            ;;
        3)
            run_make "dev" "Development Start"
            ;;
        4)
            run_make "start" "Production Start"
            ;;
        5)
            run_make "docker-simple" "Docker Simple Deployment"
            ;;
        6)
            run_make "docker-secure" "Docker Secure Deployment"
            ;;
        7)
            echo "Choose stop option:"
            echo "  a) Stop Native (PM2)"
            echo "  b) Stop Docker"
            read -p "Select [a/b]: " stop_choice
            case $stop_choice in
                a) run_make "stop" "Stop Native Services" ;;
                b) run_make "docker-stop" "Stop Docker Services" ;;
                *) echo "❌ Invalid choice" ;;
            esac
            ;;
        8)
            echo "Choose logs option:"
            echo "  a) Native Logs (PM2)"
            echo "  b) Docker Logs"
            read -p "Select [a/b]: " logs_choice
            case $logs_choice in
                a) run_make "logs" "View Native Logs" ;;
                b) run_make "docker-logs" "View Docker Logs" ;;
                *) echo "❌ Invalid choice" ;;
            esac
            ;;
        9)
            run_make "cleanup" "Interactive Cleanup"
            ;;
        10)
            run_make "docker-status" "Docker Status Check"
            ;;
        11)
            run_script "scripts/fix-certificates.sh" "Certificate Fix"
            ;;
        12)
            run_script "scripts/troubleshoot-mosquitto.sh" "MQTT Diagnostics"
            ;;
        13)
            run_script "scripts/docker-quick-start.sh" "Docker Quick Start"
            ;;
        14)
            view_doc "README.md" "Project README"
            ;;
        15)
            view_doc "scripts/README.md" "Scripts Documentation"
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option: $choice"
            echo "Please select a number between 0 and 15."
            echo ""
            read -p "Press Enter to continue..."
            echo ""
            ;;
    esac
done