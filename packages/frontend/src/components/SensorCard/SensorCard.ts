import type { SensorReadingWithAge } from "../../types/index.js";
import { TimeFormatter } from "../../utils/TimeFormatter.js";
import './SensorCard.css';

export interface SensorCardConfig {
  reading: SensorReadingWithAge;
  sensorIndex: number;
  colors: string[];
  sensorNames: Map<string, string>;
  isAdmin: boolean;
  isActive?: boolean;
  onHover: (sensorMac: string | null) => void;
  onEditName: (sensorMac: string) => void;
  onClick?: (sensorMac: string) => void;
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

    // Apply classes for state management
    this.className = `${this.isOffline ? "sensor-offline" : ""} ${this.config.isActive ? "sensor-active" : ""}`;
    this.style.borderLeftColor = this.sensorColor;
    this.style.cursor = "pointer";
    // @ts-ignore webkit specific style
    this.style.webkitTapHighlightColor = "transparent"; // Prevent iOS default gray touch highlight
    this.setAttribute("data-sensor-mac", this.config.reading.sensorMac);

    const ageText = TimeFormatter.formatAge(secondsAgo);

    this.innerHTML = `
      <div class="sensor-left">
        <div class="sensor-temp">${this.config.reading.temperature.toFixed(1)}°C</div>
        ${this.config.reading.humidity !== null ? `<div class="sensor-humidity">${this.config.reading.humidity.toFixed(1)}%</div>` : ""}
        <div class="sensor-mac" ${this.config.isAdmin ? 'style="cursor: pointer; text-decoration: underline;"' : ""}>${this.displayName}</div>
        <div class="sensor-age">${ageText}</div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Use variables to track event states
    let isTouchDevice = false;

    // Detect touch capability
    window.addEventListener(
      "touchstart",
      function onFirstTouch() {
        isTouchDevice = true;
        window.removeEventListener("touchstart", onFirstTouch);
      },
      { once: true, passive: true },
    );

    // Hover events for graph highlighting - only meaningful on non-touch devices
    this.addEventListener("mouseenter", () => {
      // Skip hover effect triggering on touch devices after touch
      if (!isTouchDevice) {
        this.config.onHover(this.config.reading.sensorMac);
      }
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
    let touchTimeout: number | null = null;

    this.addEventListener(
      "touchstart",
      (e) => {
        // Prevent default only if this is a sensor card click, not a name edit click
        if (
          !this.config.isAdmin ||
          !e
            .composedPath()
            .some(
              (el) =>
                el instanceof Element && el.classList.contains("sensor-mac"),
            )
        ) {
          e.preventDefault(); // Prevent default to avoid delayed clicks
        }

        this.config.onHover(this.config.reading.sensorMac);
        this.classList.add("touch-active");

        // Clear any existing timeout
        if (touchTimeout) {
          clearTimeout(touchTimeout);
        }
      },
      { passive: false },
    );

    this.addEventListener("touchend", (_e) => {
      // Don't prevent default here as it would prevent clicks from firing

      // Delay removing hover state to allow visual feedback
      touchTimeout = window.setTimeout(() => {
        this.config.onHover(null);
        this.classList.remove("touch-active");
        touchTimeout = null;
      }, 200);
    });

    this.addEventListener("touchcancel", () => {
      this.config.onHover(null);
      this.classList.remove("touch-active");

      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
    });

    // Click handler for toggling the sensor in the chart
    if (this.config.onClick) {
      this.addEventListener("click", (e) => {
        // Prevent accidental double-firing on iOS/Safari
        if (e.detail > 1) {
          e.preventDefault();
          return;
        }

        this.config.onClick?.(this.config.reading.sensorMac);
      });
    }

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
    const wasActive = this.classList.contains("sensor-active");

    // Only update if there are meaningful changes
    if (
      currentTemp === newTemp &&
      currentAge === newAge &&
      this.isOffline === secondsAgo > 300 &&
      wasActive === !!this.config.isActive
    ) {
      return;
    }

    this.render();
  }

  connectedCallback(): void {
    // Component added to DOM
  }

  setActive(isActive: boolean): void {
    if (this.config.isActive !== isActive) {
      this.config.isActive = isActive;
      this.classList.toggle("sensor-active", isActive);
    }
  }

  disconnectedCallback(): void {
    // Component removed from DOM - clean up event listeners if needed
    // This is important for iOS Safari which can maintain references
    this.removeEventListener("touchstart", () => {});
    this.removeEventListener("touchend", () => {});
    this.removeEventListener("touchcancel", () => {});
  }
  
  /**
   * Add attribute change handler for better component reactivity
   */
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "data-sensor-mac" && oldValue !== newValue) {
      this.render();
    }
  }
}

// Register the custom element
customElements.define("sensor-card", SensorCard);
