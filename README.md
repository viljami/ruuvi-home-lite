# Ruuvi Home Lite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

Minimal Ruuvi sensor data visualization with real-time graphs. A lightweight, self-hosted solution for monitoring RuuviTag sensors via Ruuvi Gateway with secure MQTT communication.

## ⚠️ Security Notice

**This project is designed for local network deployment only. Never expose to the internet without proper security hardening.**

## Quick Setup

```bash
# Clone repository
git clone https://github.com/your-username/ruuvi-home-lite.git
cd ruuvi-home-lite

# Run secure setup (automatically creates .env and generates certificates)
./setup.sh

# Start application
make start
```

## 🔒 Security First Setup

The setup script automatically:
- Creates `.env` configuration file from template
- Generates strong random MQTT passwords (16 characters)
- Creates TLS certificates for encrypted communication
- Sets proper file permissions (`.env` mode 600)
- Configures secure MQTT broker with authentication

## ✨ Features

- 🔐 **Secure MQTT broker** with TLS 1.2+ encryption
- 📊 **Real-time visualization** with WebSocket updates
- 🗄️ **Local SQLite storage** (no cloud dependencies)
- 📱 **Progressive Web App** with offline support
- 🌙 **Dark mode interface** (non-distracting design)
- ⏰ **Flexible time ranges** (day/week/month/year)
- 🏠 **Privacy-focused** (all data stays local)
- 🔋 **Temperature-only sensors** supported (humidity optional)

## Architecture

```
Ruuvi Gateway → MQTT (TLS) → Node.js Server → WebSocket → PWA Client
                                ↓
                           SQLite Database
```

## 📡 Ruuvi Gateway Configuration

After running setup, configure your Ruuvi Gateway with the displayed credentials:

- **MQTT Broker**: `<raspberry-pi-ip>:8883`
- **Protocol**: MQTT over TLS
- **Username**: `ruuvi`
- **Password**: `<generated-during-setup>` (shown in setup output)
- **Topic Format**: `ruuvi/{gateway_id}/{sensor_mac}`

### Expected Payload Format

Gateway sends JSON with BLE advertisement data:
```json
{
  "gw_mac": "A1:B2:C3:D4:E5:F6",
  "rssi": -62,
  "aoa": [],
  "gwts": 1728719836,
  "ts": 1728719836,
  "data": "0201061BFF9904050F18FFFFFFFFFFF0FFEC0414AA96A8DE8E123456789ABC",
  "coords": ""
}
```

**Official Documentation**: https://docs.ruuvi.com/ruuvi-gateway-firmware/gw-data-formats

> **Note**: MAC addresses in examples are obfuscated for security

## Access

- **Dashboard**: `https://<raspberry-pi-ip>:3000`
- **MQTT Broker**: `<raspberry-pi-ip>:8883` (TLS)

## 🧪 Testing

The project includes comprehensive tests with obfuscated test data:

```bash
make test-unit       # Fast unit tests (decoder validation)
make test-integration # Integration tests (requires MQTT broker)
```

All test data uses obfuscated MAC addresses for security while maintaining valid data formats.

## 📁 Project Structure

```
ruuvi-home-lite/
├── src/                 # TypeScript source code
│   ├── server.ts        # Main application orchestrator
│   ├── mqtt-client.ts   # MQTT handling and Ruuvi decoding
│   ├── web-server.ts    # WebSocket and HTTP server
│   ├── db.ts           # SQLite database operations
│   └── ruuvi-decoder.ts # Ruuvi Data Format 5 decoder
├── public/             # PWA client (HTML/CSS/JS)
├── tests/              # Test suite
├── config/             # MQTT broker configuration
└── .env.example        # Environment template
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with security in mind
4. Add tests for new functionality
5. Ensure all tests pass (`make test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

Please read [SECURITY.md](SECURITY.md) for security considerations.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ruuvi](https://ruuvi.com/) for the excellent sensor hardware and protocols
- [Ruuvi Community](https://github.com/ruuvi) for protocol documentation and examples
- Contributors to the open-source Ruuvi ecosystem

## 🆘 Troubleshooting

### Common Issues

**MQTT Connection Fails**
```bash
# Check if Mosquitto is running
sudo systemctl status mosquitto

# Check logs
sudo journalctl -u mosquitto -f
```

**Certificate Issues**
```bash
# Regenerate certificates
sudo rm -rf /etc/mosquitto/certs/*
./setup.sh  # Re-run setup
```

**Permission Issues**
```bash
# Check .env permissions
ls -la .env  # Should show -rw------- (600)

# Fix if needed
chmod 600 .env
```

For more issues, check the [Issues](https://github.com/your-username/ruuvi-home-lite/issues) page.

## 🔗 Access Points

## 🛠️ Development Commands

```bash
# Build and test
make build           # Build TypeScript
make test-unit       # Run unit tests
make test-integration # Run integration tests (requires MQTT broker)
make test            # Run all available tests

# Run application
make start           # Start with PM2 (loads .env automatically)
make stop            # Stop PM2 processes
make logs            # View PM2 logs

# Development
make dev             # Start in development mode
make clean           # Clean build artifacts
```

## 🔒 Security Features

- **Strong Authentication**: 16-character auto-generated MQTT passwords
- **TLS Encryption**: All MQTT communication encrypted (self-signed certificates)
- **Secure Storage**: `.env` file with 600 permissions (user-only access)
- **Local-only**: No internet dependencies, all data stays on your network
- **Minimal Exposure**: API only exposes temperature/humidity data
- **Data Privacy**: Full sensor data stored locally, minimal data exposed to clients

### 🚨 Security Requirements

- **Never commit** `.env` files to version control
- **Deploy only** on trusted local networks
- **Monitor** certificate expiry (10-year validity)
- **Run** `npm audit` regularly for dependency security
- **Keep** Node.js and system packages updated

## 📋 Prerequisites

- **Node.js 18+** and npm
- **Linux system** (tested on Raspberry Pi OS)
- **sudo access** for certificate generation and system service setup
- **Ruuvi Gateway** configured for MQTT output
- **Local network** (not internet-facing)