# Ruuvi Home Lite - Scripts Directory

This directory contains all setup, maintenance, and utility scripts for the Ruuvi Home Lite project.

## 📋 Script Overview

### Setup Scripts

#### `setup.sh` - Native Installation Setup
**Purpose**: Complete setup for native Raspberry Pi deployment  
**Usage**: `./setup.sh`  
**What it does**:
- Installs system dependencies (Node.js, Mosquitto, build tools)
- Generates TLS certificates for secure communication
- Creates MQTT user with secure password
- Configures firewall rules
- Sets up PM2 process manager
- Creates `.env` file with generated credentials

**Requirements**: Debian/Ubuntu system with sudo access

#### `setup-docker.sh` - Docker Environment Setup
**Purpose**: Environment variable setup for Docker deployment  
**Usage**: `./setup-docker.sh`  
**What it does**:
- Generates secure MQTT passwords
- Detects local network IP
- Creates `.env.docker` and `.env` files
- Validates environment configuration
- No system package installation (handled by Docker)

**Requirements**: Docker and Docker Compose installed

#### `env-setup.sh` - Shared Environment Functions
**Purpose**: Common functions for environment variable management  
**Usage**: Sourced by other scripts (not run directly)  
**Functions provided**:
- `detect_local_ip()` - Auto-detect local network IP
- `generate_mqtt_password()` - Create secure random passwords
- `validate_ip_address()` - IP format validation
- `create_or_update_env_file()` - Environment file management
- `setup_docker_env()` - Docker-specific environment setup
- `setup_native_env()` - Native deployment environment setup

### Maintenance Scripts

#### `cleanup.sh` - Interactive Cleanup
**Purpose**: Safe, interactive removal of installation  
**Usage**: `./cleanup.sh`  
**Features**:
- Step-by-step confirmation for each removal action
- Option to keep packages for future use
- Detailed feedback on what's being removed
- Firewall rule cleanup
- Service management

#### `remove.sh` - Quick Complete Removal
**Purpose**: Fast, complete removal without individual confirmations  
**Usage**: `./remove.sh`  
**Warning**: Requires typing "REMOVE" to confirm  
**What it removes**:
- All services and processes
- Configuration files and certificates
- Application data and logs
- Firewall rules
- Optionally removes packages

### Troubleshooting Scripts

#### `fix-certificates.sh` - Certificate Regeneration
**Purpose**: Fix TLS certificate issues  
**Usage**: `./fix-certificates.sh`  
**When to use**:
- "TLS error occurred" messages
- Certificate validation failures
- After IP address changes
- Certificate expiry issues

**What it does**:
- Stops Mosquitto service
- Generates new CA and server certificates
- Creates certificates with proper Subject Alternative Names (SAN)
- Updates Mosquitto configuration for compatibility
- Tests certificate functionality

#### `troubleshoot-mosquitto.sh` - MQTT Broker Diagnostics
**Purpose**: Comprehensive MQTT broker troubleshooting  
**Usage**: `./troubleshoot-mosquitto.sh`  
**Checks performed**:
- Service status and logs
- Configuration file syntax
- Certificate validity and permissions
- Password file integrity
- ACL configuration
- Directory permissions
- Port availability

**Features**:
- Automatic fix suggestions
- Option to apply fixes automatically
- Detailed diagnostic output

## 🚀 Quick Start Guide

### For Native Raspberry Pi Deployment:
```bash
# From project root directory
./setup.sh
# or
make setup
```

### For Docker Deployment:
```bash
# From project root directory
./setup-docker.sh
# or  
make setup-docker

# Then start with Docker Compose
docker-compose up --build -d
```

### For Troubleshooting:
```bash
# General MQTT issues
scripts/troubleshoot-mosquitto.sh

# TLS/Certificate issues
scripts/fix-certificates.sh

# Complete cleanup
scripts/cleanup.sh
```

## 🔧 Environment Files

The setup scripts create different environment files:

- **`.env`** - Used for native deployment and local development
- **`.env.docker`** - Used for Docker Compose deployment
- **`.env.example`** - Template file (committed to git)

**Important**: Never commit `.env` or `.env.docker` files to version control!

## 🛡️ Security Notes

### Password Generation
- All passwords are 16 characters with high entropy
- Generated using OpenSSL cryptographic functions
- Automatically saved to environment files with 600 permissions

### Certificate Management
- Self-signed certificates for local network use
- 10-year validity period
- Proper Subject Alternative Names (SAN) for compatibility
- Separate certificates for MQTT and web server

### File Permissions
- Private keys: 600 (owner read/write only)
- Environment files: 600 (owner read/write only)
- Configuration files: 644 (owner write, all read)

## 🔍 Troubleshooting Common Issues

### "MQTT Connection Refused: Not Authorized"
```bash
scripts/troubleshoot-mosquitto.sh
# Check ACL configuration and restart service
```

### "TLS Error Occurred"
```bash
scripts/fix-certificates.sh
# Regenerates certificates with proper configuration
```

### Service Won't Start
```bash
# Check specific service logs
sudo journalctl -u mosquitto -n 20
pm2 logs ruuvi-home

# Run comprehensive diagnostics
scripts/troubleshoot-mosquitto.sh
```

### Environment Variables Not Set
```bash
# Regenerate environment file
scripts/setup-docker.sh  # For Docker
# or
scripts/setup.sh         # For native (runs full setup)
```

## 📁 File Locations

### System Files (Native Deployment)
- MQTT Config: `/etc/mosquitto/mosquitto.conf`
- MQTT Certificates: `/etc/mosquitto/certs/`
- MQTT Passwords: `/etc/mosquitto/passwd`
- MQTT ACL: `/etc/mosquitto/acl`

### Application Files
- Environment: `.env` or `.env.docker`
- Database: `ruuvi.db`
- Logs: `logs/` directory
- Certificates: `certs/` directory (web server)

## 🏁 Script Dependencies

```
setup.sh           → env-setup.sh
setup-docker.sh    → env-setup.sh
fix-certificates.sh → (standalone)
troubleshoot-mosquitto.sh → (standalone)
cleanup.sh         → (standalone)
remove.sh          → (standalone)
```

All scripts are designed to be run from the project root directory and will handle path resolution automatically.