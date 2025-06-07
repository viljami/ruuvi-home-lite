import type { SensorReadingWithAge } from "../types/index.js";
import { TimeFormatter } from "../utils/TimeFormatter.js";

export interface SensorCardConfig {
  reading: SensorReadingWithAge;
  sensorIndex: number;
  colors: string[];
  sensorNames: Map<string, string>;
  isAdmin: boolean;
  onHover: (sensorMac: string | null) => void;
  onEditName: (sensorMac: string) => void;
}

export class SensorCard extends HTMLElement {
  private config: SensorCardConfig;
  private pendingUpdate = false;

  constructor(config: SensorCardConfig) {
    super();
    this.config = config;
    this.render();
    this.setupEventListeners();
  }

  static get observedAttributes() {
    return ["data-sensor-mac"];
  }

  get sensorColor(): string {
    return (
      this.config.colors[this.config.sensorIndex % this.config.colors.length] ||
      "#4a9eff"
    );
  }

  get displayName(): string {
    const customName =
      this.config.sensorNames.get(
        this.config.reading.sensorMac.toLowerCase(),
      ) ||
      this.config.sensorNames.get(this.config.reading.sensorMac.toUpperCase());
    return customName || this.config.reading.sensorMac.slice(-8).toUpperCase();
  }

  get isOffline(): boolean {
    const now = Math.floor(Date.now() / 1000);
    const secondsAgo =
      this.config.reading.secondsAgo !== undefined
        ? this.config.reading.secondsAgo
        : now - this.config.reading.timestamp;
    return secondsAgo > 300; // 5 minutes
  }

  private render(): void {
    const now = Math.floor(Date.now() / 1000);
    const secondsAgo =
      this.config.reading.secondsAgo !== undefined
        ? this.config.reading.secondsAgo
        : now - this.config.reading.timestamp;

    this.className = `sensor-item ${this.isOffline ? "sensor-offline" : ""}`;
    this.style.borderLeftColor = this.sensorColor;
    this.setAttribute("data-sensor-mac", this.config.reading.sensorMac);

    const ageText = TimeFormatter.formatAge(secondsAgo);

    this.innerHTML = `
      <div class="sensor-left">
        <div class="sensor-mac" ${this.config.isAdmin ? 'style="cursor: pointer; text-decoration: underline;"' : ""}>${this.displayName}</div>
        <div class="sensor-temp">${this.config.reading.temperature.toFixed(1)}°C</div>
        ${this.config.reading.humidity !== null ? `<div class="sensor-humidity">${this.config.reading.humidity.toFixed(1)}%</div>` : ""}
      </div>
      <div class="sensor-age">${ageText}</div>
    `;
  }

  private setupEventListeners(): void {
    // Hover events for graph highlighting
    this.addEventListener("mouseenter", () => {
      this.config.onHover(this.config.reading.sensorMac);
    });

    this.addEventListener("mouseleave", () => {
      this.config.onHover(null);

      // Process pending update if any
      if (this.pendingUpdate) {
        this.pendingUpdate = false;
        setTimeout(() => this.render(), 50);
      }
    });

    // Touch events for mobile
    this.addEventListener("touchstart", () => {
      this.config.onHover(this.config.reading.sensorMac);
    });

    // Admin click handler for name editing
    if (this.config.isAdmin) {
      const macElement = this.querySelector(".sensor-mac");
      macElement?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.config.onEditName(this.config.reading.sensorMac);
      });
    }
  }

  update(newConfig: Partial<SensorCardConfig>): void {
    // If card is being hovered, schedule update for later
    if (this.matches(":hover")) {
      this.pendingUpdate = true;
      return;
    }

    this.config = { ...this.config, ...newConfig };

    const now = Math.floor(Date.now() / 1000);
    const secondsAgo =
      this.config.reading.secondsAgo !== undefined
        ? this.config.reading.secondsAgo
        : now - this.config.reading.timestamp;

    // Check if significant data has changed
    const currentTemp = this.querySelector(".sensor-temp")?.textContent;
    const newTemp = `${this.config.reading.temperature.toFixed(1)}°C`;
    const currentAge = this.querySelector(".sensor-age")?.textContent;
    const newAge = TimeFormatter.formatAge(secondsAgo);

    // Only update if there are meaningful changes
    if (
      currentTemp === newTemp &&
      currentAge === newAge &&
      this.isOffline === secondsAgo > 300
    ) {
      return;
    }

    this.render();
  }

  connectedCallback(): void {
    // Component added to DOM
  }

  disconnectedCallback(): void {
    // Component removed from DOM - cleanup if needed
  }
}

// Register the custom element
customElements.define("sensor-card", SensorCard);
