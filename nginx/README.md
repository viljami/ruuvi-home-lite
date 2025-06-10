# Nginx Configuration for Ruuvi Home Lite

This directory contains Nginx configuration files to set up a reverse proxy for accessing your Ruuvi Home Lite application via a subdomain (e.g., `subdomain.local.network`).

## Setup Instructions

### 1. Install Nginx on Raspberry Pi

```bash
sudo apt update
sudo apt install nginx
```

### 2. Copy Configuration Files

Copy the configuration files from this directory to your Raspberry Pi:

```bash
# Create a backup of any existing configuration
sudo cp -r /etc/nginx/sites-available /etc/nginx/sites-available.bak

# Copy the site configuration
sudo cp subdomain.local.network.conf /etc/nginx/sites-available/subdomain.local.network
```

### 3. SSL Certificates (Optional but Recommended)

If you're using HTTPS configuration:

```bash
# Create directory for certificates if it doesn't exist
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificates (for testing)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/subdomain.local.network.key \
  -out /etc/nginx/ssl/subdomain.local.network.crt
```

Update the configuration file paths if you used different locations for your certificates.

### 4. Enable the Site

```bash
# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/subdomain.local.network /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Reload Nginx to apply changes
sudo systemctl reload nginx
```

### 5. Ensure Nginx Starts as a Service

Nginx should already be configured to start at boot by default. Verify with:

```bash
# Check if Nginx is enabled to start at boot
sudo systemctl is-enabled nginx

# If not enabled, enable it
sudo systemctl enable nginx

# Start Nginx
sudo systemctl start nginx

# Check the status
sudo systemctl status nginx
```

### 6. Set Up Local DNS

Choose one of these methods:

#### Option A: Configure your Router's DNS (Recommended)
1. Log in to your router's admin interface
2. Locate the DNS or DHCP settings
3. Add an entry for `subdomain.local.network` pointing to your Raspberry Pi's IP address

#### Option B: Edit Hosts File on Client Devices
Add this line to the hosts file on each device (replace with your Pi's actual IP):
```
192.168.1.XX subdomain.local.network
```

Hosts file locations:
- Linux/macOS: `/etc/hosts`
- Windows: `C:\Windows\System32\drivers\etc\hosts`

### 7. Testing

Access your Ruuvi application at:
- HTTP: `http://subdomain.local.network`
- HTTPS: `https://subdomain.local.network` (if configured)

## Troubleshooting

### Check Nginx Logs

```bash
# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log
```

### Verify Connectivity

```bash
# Check if Nginx is listening on ports 80/443
sudo netstat -tulpn | grep nginx

# Test the connection to your Ruuvi application
curl -I http://localhost:3000
```

### SELinux Issues (if applicable)

If you're using SELinux and facing issues:

```bash
# Allow Nginx to connect to network
sudo setsebool -P httpd_can_network_connect 1
```

### Firewall Configuration (if applicable)

```bash
# Allow HTTP/HTTPS traffic
sudo ufw allow 'Nginx Full'
```

## Configuration Files

- `subdomain.local.network.conf` - HTTP configuration
- `subdomain.local.network-https.conf` - HTTPS configuration (optional)

These files contain the necessary settings for reverse proxying to your Ruuvi application, including WebSocket support.