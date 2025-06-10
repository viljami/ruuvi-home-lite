import "./styles/app.css";
import { WebSocketManager } from "./managers/WebSocketManager.js";
import {
  SensorCard,
  ChartElement,
  SidebarElement,
} from "./components/index.js";
import { DeviceHelper } from "./utils/device/DeviceHelper.js";
import { AdminButton } from "./components/AdminButton/AdminButton.js";

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
  private currentTimeRange: TimeRange = "day";

  private isAdmin = false;
  private adminToken: string | null = null;
  private sidebar: SidebarElement | null = null;
  private chartElement: ChartElement | null = null;

  constructor() {
    // Apply device-specific fixes before initializing components
    DeviceHelper.applyAllFixes();

    // Get references to custom elements
    this.sidebar = document.getElementById("sensor-sidebar") as SidebarElement;
    this.chartElement = document.getElementById(
      "chart-container",
    ) as ChartElement;

    this.initializeWebSocket();
    this.setupControls();
    this.setupCustomElements();
    this.setupPWA();

    // Force an additional resize after initial render for mobile devices
    if (DeviceHelper.isMobile && this.chartElement) {
      setTimeout(() => this.chartElement?.resize(), 500);
    }
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
    if (this.chartElement) {
      this.chartElement.setStatus(status);
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
      console.warn(
        `No historical data received for range: ${message.timeRange}`,
      );
    }

    if (this.chartElement) {
      this.chartElement.setTimeRange(message.timeRange);
      this.chartElement.updateData(message.data);
      this.chartElement.resize();
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

    if (this.chartElement) {
      this.chartElement.updateValue(
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

    if (adminBtn && adminBtn instanceof AdminButton) {
      adminBtn.setActive(this.isAdmin);
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

        // Update chart element time range
        if (this.chartElement) {
          this.chartElement.setTimeRange(newRange);
        }
      });
    });

    // Admin button
    const adminBtn = document.getElementById("admin-btn");

    if (adminBtn) {
      // Create admin button component if it doesn't exist
      if (!(adminBtn instanceof AdminButton)) {
        const adminBtnComponent = new AdminButton({
          isActive: this.isAdmin,
          onClick: () => {
            if (this.isAdmin) {
              this.logout();
            } else {
              this.promptAdminAuth();
            }
          },
        });

        // Replace the original element with our custom component
        adminBtn.parentNode?.replaceChild(adminBtnComponent, adminBtn);
        adminBtnComponent.id = "admin-btn";
      } else {
        // Update existing component
        const adminButton = adminBtn as AdminButton;
        // We need to access the property correctly
        if (adminButton.config) {
          adminButton.config.onClick = () => {
            if (this.isAdmin) {
              this.logout();
            } else {
              this.promptAdminAuth();
            }
          };
        }
        adminButton.setActive(this.isAdmin);
      }
    }

    // Clear selection button events now handled by chart-element component

    // Listen for chart's custom events
    if (this.chartElement) {
      this.chartElement.addEventListener("sensors-cleared", () => {
        this.updateActiveSensorCards();
      });

      this.chartElement.addEventListener("sensor-toggled", (_e: Event) => {
        // We don't need the detail for now, just update the cards
        this.updateActiveSensorCards();
      });
    }
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
        isActive: this.chartElement?.isSensorActive(sensorMac) || false,
        sensorNames: this.sensorNames,
      });
    } else {
      this.renderLatestReadings();
    }
  }

  private updateActiveSensorCards(): void {
    // Update all sensor cards to reflect their active state
    this.sensorCards.forEach((card, sensorMac) => {
      card.setActive(this.chartElement?.isSensorActive(sensorMac) || false);
    });

    // Clear button visibility is now handled by the chart-element component
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
        '<div class="no-sensors-message">No sensor data</div>';
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
        isActive: this.chartElement?.isSensorActive(reading.sensorMac) || false,
        onHover: (sensorMac) => {
          if (this.chartElement) {
            this.chartElement.setHoveredSensor(sensorMac);
          }
        },
        onClick: (sensorMac) => {
          if (this.chartElement) {
            this.chartElement.toggleSensor(sensorMac);
            // Update active state on cards
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

    // Apply touch event fixes to all new sensor cards
    DeviceHelper.fixAllTouchEvents(container);
  }

  private setupCustomElements(): void {
    // Listen for sidebar events that might affect layout
    if (this.sidebar && this.chartElement) {
      this.sidebar.addEventListener("sidebar-expanded", () => {
        // Resize the chart when sidebar expands
        this.chartElement?.resize();
      });

      this.sidebar.addEventListener("sidebar-collapsed", () => {
        // Resize the chart when sidebar collapses
        this.chartElement?.resize();
      });
    }

    // Set up sensor card hovering to highlight chart lines
    document.addEventListener("mouseover", (e: Event) => {
      const target = e.target as Element;
      const sensorCard = target.closest("sensor-card");
      if (sensorCard) {
        const sensorMac = sensorCard.getAttribute("data-sensor-mac");
        if (sensorMac && this.chartElement) {
          this.chartElement.setHoveredSensor(sensorMac);
        }
      }
    });

    document.addEventListener("mouseout", (e: Event) => {
      const target = e.target as Element;
      if (target.closest("sensor-card")) {
        this.chartElement?.setHoveredSensor(null);
      }
    });
  }

  private setupPWA(): void {
    // PWA Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // Handle PWA display mode changes
    window
      .matchMedia("(display-mode: standalone)")
      .addEventListener("change", () => {
        // Refresh sidebar when switching to/from standalone mode
        this.sidebar?.refresh();
        // Ensure chart is properly sized in standalone mode
        this.chartElement?.resize();
      });

    // Add observer for new elements to apply touch event fixes
    const container = document.getElementById("latest-readings");
    if (container && DeviceHelper.isMobile) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length) {
            DeviceHelper.fixAllTouchEvents(container);
          }
        });
      });

      observer.observe(container, { childList: true });
    }
  }
}

// Initialize the application
new RuuviApp();
