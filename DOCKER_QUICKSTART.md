# Docker Quick Start Guide

## 🚨 Fix for Volume Permission Issues

The Docker deployment has been experiencing volume permission and read-only filesystem issues. This guide provides working solutions.

## 🚀 Quick Setup (2 Methods)

### Method 1: Simple Setup (No TLS)

**Best for initial testing and troubleshooting:**

```bash
# 1. Clone repository
git clone https://github.com/yourusername/ruuvi-home-lite.git
cd ruuvi-home-lite

# 2. Start simple deployment (no certificates needed)
docker-compose -f docker-compose.simple.yml up --build -d

# 3. Check status
docker-compose -f docker-compose.simple.yml ps
docker-compose -f docker-compose.simple.yml logs -f
```

**Access:** http://your_pi_ip:3000 (HTTP, no TLS)

**MQTT Settings for Gateway:**
- Server: `your_pi_ip:1883`
- Protocol: MQTT (no TLS)
- Username: (leave empty)
- Password: (leave empty)

### Method 2: Secure Setup (With TLS)

**For production use:**

```bash
# 1. Clone repository
git clone https://github.com/yourusername/ruuvi-home-lite.git
cd ruuvi-home-lite

# 2. Setup environment and initialize volumes
./setup-docker.sh

# 3. Start secure deployment
docker-compose up --build -d

# 4. Check status
docker-compose ps
docker-compose logs -f
```

**Access:** https://your_pi_ip:3000 (HTTPS with self-signed certificate)

## 🔧 Fixing Common Docker Issues

### Issue 1: "Read-only file system" Errors

**Problem:**
```
chown: /mosquitto/config/mosquitto.conf: Read-only file system
```

**Solution:**
Use the simple deployment first, then upgrade:

```bash
# Stop any running containers
docker-compose down -v
docker-compose -f docker-compose.simple.yml down -v

# Remove problematic volumes
docker volume prune -f

# Start simple deployment
docker-compose -f docker-compose.simple.yml up --build -d
```

### Issue 2: "Unable to write pid file"

**Problem:**
```
Error: Unable to write pid file.
```

**Solutions:**

**Option A - Use Simple Deployment:**
```bash
docker-compose -f docker-compose.simple.yml up --build -d
```

**Option B - Fix Volume Permissions:**
```bash
# Create and fix volume permissions
docker volume create ruuvi-home-lite_mosquitto_run
docker run --rm -v ruuvi-home-lite_mosquitto_run:/run alpine:latest chmod 777 /run
```

### Issue 3: Certificate/Authentication Errors

**Problem:**
```
MQTT Connection refused: Not authorized
```

**Quick Fix - Use Insecure Mode:**
```bash
# Edit .env file
echo "MQTT_PORT=1883" >> .env
echo "MQTT_USER=" >> .env  
echo "MQTT_PASS=" >> .env

# Restart with simple compose
docker-compose -f docker-compose.simple.yml up --build -d
```

## 📊 Testing Your Deployment

### Test MQTT Connection

**For Simple Deployment (Port 1883):**
```bash
# Test from host machine
mosquitto_pub -h localhost -p 1883 -t test/topic -m "hello"

# Test from inside container
docker exec ruuvi-mosquitto-simple mosquitto_pub -h localhost -p 1883 -t test/topic -m "hello"
```

**For Secure Deployment (Port 8883):**
```bash
# Test with credentials
mosquitto_pub -h localhost -p 8883 -u ruuvi -P "$(grep MQTT_PASS .env.docker | cut -d'=' -f2)" -t test/topic -m "hello" --insecure
```

### Test Web Interface

**Simple Deployment:**
```bash
curl http://localhost:3000
```

**Secure Deployment:**
```bash
curl -k https://localhost:3000
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mosquitto
docker-compose logs -f ruuvi-app

# Simple deployment
docker-compose -f docker-compose.simple.yml logs -f
```

## 🔄 Upgrading from Simple to Secure

Once simple deployment works, upgrade to secure:

```bash
# 1. Stop simple deployment
docker-compose -f docker-compose.simple.yml down

# 2. Setup secure environment
./setup-docker.sh

# 3. Start secure deployment
docker-compose up --build -d

# 4. Update gateway settings to use port 8883 with credentials
```

## 🐛 Troubleshooting Commands

### Container Status
```bash
# Check if containers are running
docker ps

# Check container resource usage
docker stats

# Check container health
docker-compose ps
```

### Volume Issues
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect ruuvi-home-lite_mosquitto_data

# Remove all project volumes (DESTRUCTIVE)
docker-compose down -v
docker volume prune -f
```

### Network Issues
```bash
# Check Docker networks
docker network ls

# Inspect project network
docker network inspect ruuvi-home-lite_ruuvi-network

# Test connectivity between containers
docker exec ruuvi-home ping mosquitto
```

### Complete Reset
```bash
# Nuclear option - removes everything
docker-compose down -v
docker-compose -f docker-compose.simple.yml down -v
docker system prune -af
docker volume prune -f

# Then start fresh
docker-compose -f docker-compose.simple.yml up --build -d
```

## 📋 Deployment Comparison

| Feature | Simple Deployment | Secure Deployment |
|---------|------------------|-------------------|
| **Setup Time** | 5 minutes | 15 minutes |
| **Security** | ⚠️ Insecure | ✅ TLS Encrypted |
| **Certificates** | None needed | Auto-generated |
| **MQTT Port** | 1883 (insecure) | 8883 (secure) |
| **Authentication** | None | Username/Password |
| **Web Interface** | HTTP | HTTPS |
| **Troubleshooting** | Easy | More complex |
| **Production Ready** | ❌ No | ✅ Yes |

## 🔑 Gateway Configuration

### For Simple Deployment
```
MQTT Server: your_pi_ip:1883
Protocol: MQTT
Security: None
Username: (empty)
Password: (empty)
```

### For Secure Deployment
```
MQTT Server: your_pi_ip:8883
Protocol: MQTT over TLS
Security: TLS (ignore certificate errors)
Username: ruuvi
Password: (from .env.docker file)
```

## 📖 Next Steps

1. **Start with Simple:** Use `docker-compose.simple.yml` to verify basic functionality
2. **Test Gateway:** Configure your Ruuvi Gateway with insecure settings first
3. **Verify Data:** Check that sensor data appears in the web interface
4. **Upgrade Security:** Once working, upgrade to secure deployment
5. **Production Setup:** Use secure deployment for ongoing operation

## 🆘 Getting Help

If you encounter issues:

1. **Check logs:** `docker-compose logs -f`
2. **Try simple deployment:** `docker-compose -f docker-compose.simple.yml up -d`
3. **Reset volumes:** `docker-compose down -v && docker volume prune -f`
4. **Check host networking:** Ensure ports 1883/8883 and 3000 are available
5. **Verify Docker installation:** `docker --version && docker-compose --version`

Remember: Start simple, verify functionality, then add security!