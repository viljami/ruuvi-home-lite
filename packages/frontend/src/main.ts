import { WebSocketManager } from "./managers/WebSocketManager.js";
import { SensorCard } from "./components/SensorCard.js";
import { SensorChart } from "./components/chart/SensorChart.js";

import type {
  ServerMessage,
  SensorReadingWithAge,
  TimeRange,
  SensorDataMessage,
  HistoricalDataMessage,
  LatestReadingsMessage,
  AdminAuthResultMessage,
  SensorNamesMessage,
} from "./types/index.js";

class RuuviApp {
  private wsManager!: WebSocketManager;
  private sensorCards = new Map<string, SensorCard>();
  private latestReadings = new Map<string, SensorReadingWithAge>();
  private sensorNames = new Map<string, string>();
  private colors = [
    "#4a9eff", // bright blue
    "#ff6b6b", // coral red
    "#4ecdc4", // cyan green
    "#ff9f40", // bright orange
    "#c7ff6b", // lime yellow
    "#ffeaa7", // light yellow
    "#b48eff", // soft purple / lavender
    "#ff4fa3", // hot pink / magenta
    "#7dff72", // neon green
  ];
  private sensorChart: SensorChart | null = null;
  private currentTimeRange: TimeRange = "day";

  private isAdmin = false;
  private adminToken: string | null = null;

  constructor() {
    this.initializeWebSocket();
    this.setupControls();
    this.setupCharts();
    this.setupPWA();

    // No need to log initialization in production
  }

  private initializeWebSocket(): void {
    this.wsManager = new WebSocketManager({
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      onMessage: (message) => this.handleServerMessage(message),
      onStatusChange: (status) => this.updateConnectionStatus(status),
    });

    this.wsManager.connect();
  }

  private updateConnectionStatus(status: string): void {
    const statusElement = document.getElementById("status");

    if (statusElement) {
      statusElement.textContent = status === "connected" ? "real time" : status;
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case "historicalData":
        this.handleHistoricalData(message);
        break;
      case "sensorData":
        this.handleSensorData(message);
        break;
      case "latestReadings":
        this.handleLatestReadings(message);
        break;
      case "bucketUpdate":
        this.handleBucketUpdate();
        break;
      case "adminAuthResult":
        this.handleAdminAuthResult(message);
        break;
      case "sensorNames":
        this.handleSensorNames(message);
        break;
      default:
        console.warn("Unknown message type received:", message);
    }
  }

  private handleHistoricalData(message: HistoricalDataMessage): void {
    // Only log if no data received (potential issue)
    if (message.data.length === 0) {
      console.warn(`No historical data received for range: ${message.timeRange}`);
    }

    if (this.sensorChart) {
      this.sensorChart.setTimeRange(message.timeRange);
      this.sensorChart.updateData(message.data);
    }
  }

  private handleSensorData(message: SensorDataMessage): void {
    const normalizedMac = message.data.sensorMac.toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    this.latestReadings.set(normalizedMac, {
      ...message.data,
      secondsAgo: now - message.data.timestamp,
    });

    this.updateSensorCard(normalizedMac);

    if (this.sensorChart) {
      this.sensorChart.updateValue(
        normalizedMac,
        message.data.timestamp,
        message.data.temperature,
        message.data.humidity || undefined,
      );
    }
  }

  private handleLatestReadings(message: LatestReadingsMessage): void {
    Object.entries(message.data).forEach(([mac, reading]) => {
      this.latestReadings.set(mac.toLowerCase(), reading);
      this.updateSensorCard(mac.toLowerCase());
    });
    
    // Only log if no readings received (potential issue)
    if (Object.keys(message.data).length === 0) {
      console.warn("No sensor readings received from server");
    }
  }

  private handleBucketUpdate(): void {
    // Quietly process bucket updates without logging
    // For now, re-request full data to get updated chart
    // In a more optimized version, we would update just the affected bucket
    this.wsManager.send({ type: "getData", timeRange: this.currentTimeRange });
  }

  private handleAdminAuthResult(message: AdminAuthResultMessage): void {
    if (message.success) {
      this.isAdmin = true;
      this.adminToken = message.token || null;
      this.updateAdminUI();
      this.renderLatestReadings();
    } else {
      alert(message.message || "Authentication failed");
    }
  }

  private handleSensorNames(message: SensorNamesMessage): void {
    this.sensorNames.clear();

    message.data.forEach(({ sensorMac, customName }) => {
      this.sensorNames.set(sensorMac.toLowerCase(), customName || sensorMac);
    });

    this.renderLatestReadings();
  }

  private updateAdminUI(): void {
    const adminBtn = document.getElementById("admin-btn");

    if (adminBtn) {
      if (this.isAdmin) {
        adminBtn.textContent = "Logout";
        adminBtn.style.background = "#ff6b6b";
      } else {
        adminBtn.textContent = "Admin";
        adminBtn.style.background = "#333";
      }
    }
  }

  private setupControls(): void {
    // Time range controls
    document.querySelectorAll(".btn[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const newRange = (btn as HTMLElement).dataset.range as TimeRange;

        document.querySelector(".btn.active")?.classList.remove("active");
        btn.classList.add("active");

        // No need to log every time range change
        this.currentTimeRange = newRange;
        this.wsManager.send({ type: "getData", timeRange: newRange });
      });
    });

    // Admin button
    const adminBtn = document.getElementById("admin-btn");

    adminBtn?.addEventListener("click", () => {
      if (this.isAdmin) {
        this.logout();
      } else {
        this.promptAdminAuth();
      }
    });

    // Clear selection button
    const clearBtn = document.getElementById("clear-selection-btn");
    
    // Hide clear button initially
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    
    clearBtn?.addEventListener("click", () => {
      if (this.sensorChart) {
        this.sensorChart.clearActiveSensors();
        this.updateActiveSensorCards();
        // Hide button after clearing
        if (clearBtn) {
          clearBtn.style.display = 'none';
        }
      }
    });
  }

  private promptAdminAuth(): void {
    const password = prompt("Enter admin password:");

    if (password) {
      this.wsManager.send({
        type: "adminAuth",
        password: password,
      });
    }
  }

  private logout(): void {
    this.isAdmin = false;
    this.adminToken = null;
    this.updateAdminUI();
    this.renderLatestReadings();
  }

  private editSensorName(sensorMac: string): void {
    const currentName =
      this.sensorNames.get(sensorMac) || sensorMac.slice(-8).toUpperCase();
    const newName = prompt(
      `Enter name for sensor ${sensorMac.slice(-8).toUpperCase()}:`,
      currentName,
    );

    if (newName && newName.trim() !== currentName) {
      this.wsManager.send({
        type: "setSensorName",
        sensorMac: sensorMac,
        customName: newName.trim(),
        adminToken: this.adminToken!,
      });
    }
  }

  private updateSensorCard(sensorMac: string): void {
    const reading = this.latestReadings.get(sensorMac);
    if (!reading) return;

    const sortedReadings = Array.from(this.latestReadings.values()).sort(
      (a, b) => a.sensorMac.localeCompare(b.sensorMac),
    );
    const sensorIndex = sortedReadings.findIndex(
      (r) => r.sensorMac === sensorMac,
    );

    const existingCard = this.sensorCards.get(sensorMac);
    if (existingCard) {
      existingCard.update({
        reading,
        sensorIndex,
        isAdmin: this.isAdmin,
        isActive: this.sensorChart?.isSensorActive(sensorMac) || false,
        sensorNames: this.sensorNames,
      });
    } else {
      this.renderLatestReadings();
    }
  }

  private updateActiveSensorCards(): void {
    // Update all sensor cards to reflect their active state
    this.sensorCards.forEach((card, sensorMac) => {
      card.setActive(this.sensorChart?.isSensorActive(sensorMac) || false);
    });
    
    // Update clear button visibility
    const clearBtn = document.getElementById("clear-selection-btn");
    if (clearBtn && this.sensorChart) {
      const hasActiveSensors = this.sensorChart.getActiveSensors().length > 0;
      clearBtn.style.display = hasActiveSensors ? 'block' : 'none';
    }
  }

  private renderLatestReadings(): void {
    const container = document.getElementById("latest-readings");
    if (!container) return;

    // Clear existing cards
    this.sensorCards.forEach((card) => card.remove());
    this.sensorCards.clear();
    container.innerHTML = "";

    if (this.latestReadings.size === 0) {
      container.innerHTML =
        '<div style="color: #666; text-align: center; padding: 20px;">No sensor data</div>';
      return;
    }

    const sortedReadings = Array.from(this.latestReadings.values()).sort(
      (a, b) => a.sensorMac.localeCompare(b.sensorMac),
    );

    sortedReadings.forEach((reading, index) => {
      const sensorCard = new SensorCard({
        reading,
        sensorIndex: index,
        colors: this.colors,
        sensorNames: this.sensorNames,
        isAdmin: this.isAdmin,
        isActive: this.sensorChart?.isSensorActive(reading.sensorMac) || false,
        onHover: (sensorMac) => {
          if (this.sensorChart) {
            this.sensorChart.setHoveredSensor(sensorMac);
          }
        },
        onClick: (sensorMac) => {
          if (this.sensorChart) {
            this.sensorChart.toggleSensor(sensorMac);
            // Update active state on cards and clear button visibility
            this.updateActiveSensorCards();
          }
        },
        onEditName: (sensorMac) => {
          this.editSensorName(sensorMac);
        },
      });

      this.sensorCards.set(reading.sensorMac, sensorCard);
      container.appendChild(sensorCard);
    });
  }

  private setupCharts(): void {
    const canvas = document.getElementById("chart") as HTMLCanvasElement;
    if (canvas) {
      this.sensorChart = new SensorChart(canvas, {
        colors: this.colors,
        showHumidity: true,
        showMinMaxBands: true,
      });

      // Set up canvas click handler for sensor selection
      canvas.addEventListener("click", (_event) => {
        if (!this.sensorChart) return;

        // Find which sensor line was clicked (simplified approach)
        // In a more advanced implementation, you could check proximity to lines
        const hoveredSensor = this.sensorChart["hoveredSensor"];
        if (hoveredSensor) {
          this.sensorChart.toggleSensor(hoveredSensor);
          // Update active state on cards and clear button visibility
          this.updateActiveSensorCards();
        }
      });

      // Handle window resize
      window.addEventListener("resize", () => {
        this.sensorChart?.resize();
      });
    }
  }

  private setupPWA(): void {
    // PWA Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }
}

// Initialize the application
new RuuviApp();
