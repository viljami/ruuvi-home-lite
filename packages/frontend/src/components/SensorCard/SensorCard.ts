import type { SensorReadingWithAge } from "../../types/index.js";
import { TimeFormatter } from "../../utils/TimeFormatter.js";
import "./SensorCard.css";

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

  // DOM element references
  private leftContainer: HTMLDivElement | null = null;
  private tempElement: HTMLDivElement | null = null;
  private humidityElement: HTMLDivElement | null = null;
  private macElement: HTMLDivElement | null = null;
  private ageElement: HTMLDivElement | null = null;

  private isTouchDevice = false;

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
    this.style.setProperty('--sensor-color', this.sensorColor);
    this.style.cursor = "pointer";
    // @ts-ignore webkit specific style
    this.style.webkitTapHighlightColor = "transparent"; // Prevent iOS default gray touch highlight
    this.setAttribute("data-sensor-mac", this.config.reading.sensorMac);

    const ageText = TimeFormatter.formatAge(secondsAgo);
    const shouldShowHumidity = this.config.reading.humidity !== null;
    const shouldShowAge = secondsAgo > 300;

    // Check if we need to create the DOM structure or just update it
    if (!this.leftContainer) {
      // First render - create the DOM structure
      this.innerHTML = ""; // Clear any existing content

      this.leftContainer = document.createElement("div");
      this.leftContainer.className = "sensor-left";

      this.tempElement = document.createElement("div");
      this.tempElement.className = "sensor-temp";
      this.leftContainer.appendChild(this.tempElement);

      if (shouldShowHumidity) {
        this.humidityElement = document.createElement("div");
        this.humidityElement.className = "sensor-humidity";
        this.leftContainer.appendChild(this.humidityElement);
      }

      this.macElement = document.createElement("div");
      this.macElement.className = "sensor-mac";
      this.leftContainer.appendChild(this.macElement);

      if (shouldShowAge) {
        this.ageElement = document.createElement("div");
        this.ageElement.className = "sensor-age";
        this.leftContainer.appendChild(this.ageElement);
      }

      this.appendChild(this.leftContainer);

      // Set up admin event handler if needed
      if (this.config.isAdmin && this.macElement) {
        this.macElement.addEventListener("click", this.handleMacClick);
        this.macElement.style.cursor = "pointer";
        this.macElement.style.textDecoration = "underline";
      }
    } else {
      // Update existing elements

      // Handle humidity element (may need to add/remove)
      if (shouldShowHumidity && !this.humidityElement && this.leftContainer) {
        this.humidityElement = document.createElement("div");
        this.humidityElement.className = "sensor-humidity";
        // Insert after temperature element
        if (this.tempElement && this.tempElement.nextSibling) {
          this.leftContainer.insertBefore(
            this.humidityElement,
            this.tempElement.nextSibling,
          );
        } else {
          this.leftContainer.appendChild(this.humidityElement);
        }
      } else if (!shouldShowHumidity && this.humidityElement) {
        this.humidityElement.remove();
        this.humidityElement = null;
      }

      // Handle age element (may need to add/remove)
      if (shouldShowAge && !this.ageElement && this.leftContainer) {
        this.ageElement = document.createElement("div");
        this.ageElement.className = "sensor-age";
        this.leftContainer.appendChild(this.ageElement);
      } else if (!shouldShowAge && this.ageElement) {
        this.ageElement.remove();
        this.ageElement = null;
      }

      // Update admin-specific attributes for the MAC element
      if (this.macElement) {
        if (this.config.isAdmin) {
          this.macElement.style.cursor = "pointer";
          this.macElement.style.textDecoration = "underline";
          // Add click handler if not already added
          if (!this.macElement.onclick) {
            this.macElement.addEventListener("click", this.handleMacClick);
          }
        } else {
          this.macElement.style.cursor = "";
          this.macElement.style.textDecoration = "";
          this.macElement.removeEventListener("click", this.handleMacClick);
        }
      }
    }

    // Update the content of each element
    if (this.tempElement) {
      this.tempElement.textContent = `${this.config.reading.temperature.toFixed(1)}°C`;
    }

    if (this.humidityElement && shouldShowHumidity) {
      this.humidityElement.textContent = `${this.config.reading.humidity!.toFixed(1)}%`;
    }

    if (this.macElement) {
      this.macElement.textContent = this.displayName;
    }

    if (this.ageElement && shouldShowAge) {
      this.ageElement.textContent = ageText;
    }
  }

  // Event handlers as class methods
  private handleMouseEnter = (): void => {
    // Skip hover effect triggering on touch devices after touch
    if (!this.isTouchDevice) {
      this.config.onHover(this.config.reading.sensorMac);
    }
  };

  private handleMouseLeave = (): void => {
    this.config.onHover(null);
    this.render();
  };

  private handleTouchStart = (e: TouchEvent): void => {
    // Prevent default only if this is a sensor card click, not a name edit click
    if (
      !this.config.isAdmin ||
      !e
        .composedPath()
        .some(
          (el) => el instanceof Element && el.classList.contains("sensor-mac"),
        )
    ) {
      e.preventDefault(); // Prevent default to avoid delayed clicks
    }

    this.config.onHover(this.config.reading.sensorMac);
    this.classList.add("touch-active");
  };

  private handleTouchEnd = (_e: TouchEvent): void => {
    this.config.onHover(null);
    this.classList.remove("touch-active");
  };

  private handleTouchCancel = (): void => {
    this.config.onHover(null);
    this.classList.remove("touch-active");
  };

  private handleClick = (e: MouseEvent): void => {
    // Prevent accidental double-firing on iOS/Safari
    if (e.detail > 1) {
      e.preventDefault();
      return;
    }

    this.config.onClick?.(this.config.reading.sensorMac);
  };

  private handleMacClick = (e: MouseEvent): void => {
    e.stopPropagation();
    this.config.onEditName(this.config.reading.sensorMac);
  };

  private detectTouchCapability = (): void => {
    this.isTouchDevice = true;
    window.removeEventListener("touchstart", this.detectTouchCapability);
  };

  private setupEventListeners(): void {
    // Detect touch capability
    window.addEventListener("touchstart", this.detectTouchCapability, {
      once: true,
      passive: true,
    });

    // Hover events for graph highlighting - only meaningful on non-touch devices
    this.addEventListener("mouseenter", this.handleMouseEnter);
    this.addEventListener("mouseleave", this.handleMouseLeave);

    // Touch events for mobile
    this.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });
    this.addEventListener("touchend", this.handleTouchEnd);
    this.addEventListener("touchcancel", this.handleTouchCancel);

    // Click handler for toggling the sensor in the chart
    if (this.config.onClick) {
      this.addEventListener("click", this.handleClick);
    }

    // Admin click handler for name editing is now added in the render method
    // when the macElement is created
  }

  update(newConfig: Partial<SensorCardConfig>): void {
    // If card is being hovered, schedule update for later
    if (this.matches(":hover")) {
      return;
    }

    this.config = { ...this.config, ...newConfig };

    const now = Math.floor(Date.now() / 1000);
    const secondsAgo =
      this.config.reading.secondsAgo !== undefined
        ? this.config.reading.secondsAgo
        : now - this.config.reading.timestamp;

    // Check if significant data has changed
    const currentTemp = this.tempElement?.textContent;
    const newTemp = `${this.config.reading.temperature.toFixed(1)}°C`;
    const currentAge = this.ageElement?.textContent;
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
    // Component removed from DOM - clean up event listeners
    // This is important for iOS Safari which can maintain references
    window.removeEventListener("touchstart", this.detectTouchCapability);

    this.removeEventListener("mouseenter", this.handleMouseEnter);
    this.removeEventListener("mouseleave", this.handleMouseLeave);
    this.removeEventListener("touchstart", this.handleTouchStart);
    this.removeEventListener("touchend", this.handleTouchEnd);
    this.removeEventListener("touchcancel", this.handleTouchCancel);
    this.removeEventListener("click", this.handleClick);

    // Clean up the MAC element click handler if it exists
    if (this.macElement) {
      this.macElement.removeEventListener("click", this.handleMacClick);
    }

    // Clear element references
    this.leftContainer = null;
    this.tempElement = null;
    this.humidityElement = null;
    this.macElement = null;
    this.ageElement = null;
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
