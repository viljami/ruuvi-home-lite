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
    "#4a9eff",
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#ffeaa7",
  ];
  private chart: SensorChart | null = null;
  private currentTimeRange: TimeRange = "day";

  private isAdmin = false;
  private adminToken: string | null = null;

  constructor() {
    this.initializeWebSocket();
    this.setupControls();
    this.setupChart();
    this.setupPWA();

    console.log("🚀 Ruuvi Home Lite initialized with modular architecture");
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
        console.log("Unknown message type:", message);
    }
  }

  private handleHistoricalData(message: HistoricalDataMessage): void {
    console.log(
      `📊 Loaded ${message.data.length} historical data points (${message.timeRange})`,
    );

    if (this.chart) {
      this.chart.setTimeRange(message.timeRange);
      this.chart.updateData(message.data);
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
    if (this.chart) {
      this.chart.updateValue(
        normalizedMac,
        message.data.timestamp,
        message.data.temperature,
      );

      if (this.chart.isOutDated(normalizedMac)) {
        this.handleBucketUpdate();
      }
    }
  }

  private handleLatestReadings(message: LatestReadingsMessage): void {
    Object.entries(message.data).forEach(([mac, reading]) => {
      this.latestReadings.set(mac.toLowerCase(), reading);
      this.updateSensorCard(mac.toLowerCase());
    });
    console.log(
      `📱 Loaded ${Object.keys(message.data).length} latest readings`,
    );
  }

  private handleBucketUpdate(): void {
    console.log("📊 Bucket update received");

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
    Object.entries(message.data).forEach(([mac, sensorNameObj]) => {
      this.sensorNames.set(mac.toLowerCase(), sensorNameObj.customName || mac);
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

        console.log(`📅 Time range changed to: ${newRange}`);
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
        sensorNames: this.sensorNames,
      });
    } else {
      this.renderLatestReadings();
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
        onHover: (sensorMac) => {
          if (this.chart) {
            this.chart.setHoveredSensor(sensorMac);
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

  private setupChart(): void {
    const canvas = document.getElementById("chart") as HTMLCanvasElement;
    if (canvas) {
      this.chart = new SensorChart(canvas, {
        colors: this.colors,
        type: "temperature", // Default to temperature
      });

      // Handle window resize
      window.addEventListener("resize", () => {
        this.chart?.resize();
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
