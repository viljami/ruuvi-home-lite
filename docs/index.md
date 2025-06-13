---
layout: default
---

# Ruuvi Home Lite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)

Minimal Ruuvi sensor data visualization with real-time graphs. A lightweight, self-hosted solution for monitoring RuuviTag sensors via Ruuvi Gateway with secure MQTT communication. AI co-coded for robust architecture and security.

![Ruuvi Home Lite Dashboard](assets/images/screenshot-dark.png)

## ✨ Features

- 🔐 **Secure MQTT broker** with TLS 1.2+ encryption
- 📊 **Real-time visualization** with WebSocket updates
- 🗄️ **Local SQLite storage** (no cloud dependencies)
- 📱 **Progressive Web App** with offline support
- 🌙 **Dark mode interface** (system-matching design)
- ⏰ **Flexible time ranges** (day/week/month/year)
- 🐳 **Docker support** for containerized deployment

## 🚀 Quick Start

### Interactive Setup (Recommended)

```bash
git clone https://github.com/your-username/ruuvi-home-lite.git
cd ruuvi-home-lite
make launcher    # Interactive menu with all options
```

### Direct Commands

```bash
# Native Deployment (Raspberry Pi)
make setup && make start

# Docker Deployment
make setup-docker && make docker-secure

# Development
make dev
```

## 🌐 Access Options

- **Direct Access**: `http://your-host-ip:3000` or `https://your-host-ip:3000` (if TLS enabled)
- **Subdomain Access**: Use the included Nginx configuration for `subdomain.local.network`

<div class="github-link">
  <a href="https://github.com/your-username/ruuvi-home-lite" class="btn">View on GitHub</a>
</div>

## Screenshots

<div class="screenshot-gallery">
  <a href="assets/images/screenshot-dark.png" target="_blank">
    <img src="assets/images/screenshot-dark.png" alt="Dark Mode Dashboard" width="30%">
  </a>
  <a href="assets/images/screenshot-light.png" target="_blank">
    <img src="assets/images/screenshot-light.png" alt="Light Mode Dashboard" width="30%">
  </a>
  <a href="assets/images/screenshot-dark-2x-selected-sensors.png" target="_blank">
    <img src="assets/images/screenshot-dark-2x-selected-sensors.png" alt="Selected Sensors View" width="30%">
  </a>
</div>
