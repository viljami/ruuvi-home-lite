/**
 * ChartElement Component
 *
 * A custom element wrapper for SensorChart that provides proper DOM
 * management, event handling, and lifecycle management.
 */

import { SensorChart } from "../SensorChart.js";
import type { TimeRange, AggregatedSensorData } from "../../../types/index.js";
import "./ChartElement.css";

export interface ChartElementConfig {
  showHumidity?: boolean;
  showMinMaxBands?: boolean;
  colors?: string[];
}

export class ChartElement extends HTMLElement {
  // DOM element references
  private canvas: HTMLCanvasElement | null = null;
  private controlsContainer: HTMLDivElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private statusIndicator: HTMLSpanElement | null = null;

  // Chart instance
  private chart: SensorChart | null = null;

  // Configuration
  private config: ChartElementConfig = {
    showHumidity: true,
    showMinMaxBands: true,
    colors: [
      "#4a9eff", // bright blue
      "#ff6b6b", // coral red
      "#4ecdc4", // cyan green
      "#ff9f40", // bright orange
      "#c7ff6b", // lime yellow
      "#ffeaa7", // light yellow
      "#b48eff", // soft purple
      "#ff4fa3", // hot pink
      "#7dff72", // neon green
    ],
  };

  // Resize handling
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeout: number | null = null;

  static get observedAttributes() {
    return ["show-humidity", "show-min-max", "time-range"];
  }

  constructor() {
    super();
    this.handleResize = this.handleResize.bind(this);
    this.handleClearClick = this.handleClearClick.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
  }

  /**
   * Called when the element is added to the DOM
   */
  connectedCallback(): void {
    // Create the DOM structure
    this.render();

    // Initialize the chart
    this.initializeChart();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Create the DOM structure
   */
  private render(): void {
    // Create container for controls if it doesn't exist
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement("div");
      this.controlsContainer.className = "chart-controls";

      // Create clear button
      this.clearButton = document.createElement("button");
      this.clearButton.id = "clear-selection-btn";
      this.clearButton.className = "btn btn-secondary";
      this.clearButton.textContent = "Clear";
      this.clearButton.style.display = "none"; // Hidden by default

      this.controlsContainer.appendChild(this.clearButton);
      this.appendChild(this.controlsContainer);
    }

    // Create canvas if it doesn't exist
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.id = "chart";
      this.appendChild(this.canvas);
    }

    // Create status indicator if it doesn't exist
    if (!this.statusIndicator) {
      const statusContainer = document.createElement("div");
      statusContainer.className = "chart-status";

      this.statusIndicator = document.createElement("span");
      this.statusIndicator.id = "status-indicator";
      this.statusIndicator.className = "status";
      this.statusIndicator.textContent = "Connecting";

      statusContainer.appendChild(this.statusIndicator);
      this.appendChild(statusContainer);
    }
  }

  /**
   * Initialize the chart
   */
  private initializeChart(): void {
    if (!this.canvas) return;

    this.chart = new SensorChart(this.canvas, {
      colors: this.config.colors || [],
      showHumidity: this.config.showHumidity ?? true,
      showMinMaxBands: this.config.showMinMaxBands ?? true,
    });

    // Apply any attributes that were set before initialization
    if (this.hasAttribute("time-range")) {
      const timeRange = this.getAttribute("time-range") as TimeRange;
      this.chart.setTimeRange(timeRange);
    }
    
    // Force initial resize to ensure proper rendering
    setTimeout(() => {
      if (this.chart) {
        this.chart.resize();
      }
    }, 50);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Canvas click for sensor selection
    if (this.canvas) {
      this.canvas.addEventListener("click", this.handleCanvasClick);
    }

    // Clear button
    if (this.clearButton) {
      this.clearButton.addEventListener("click", this.handleClearClick);
    }

    // Set up resize observation for both the canvas and its parent
    if (this.canvas) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.canvas);
      
      // Also observe the parent element for container-based resizing
      if (this.canvas.parentElement) {
        this.resizeObserver.observe(this.canvas.parentElement);
      }
    }

    // Listen for window resize as a backup
    window.addEventListener("resize", this.handleResize);

    // Listen for orientation changes
    window.addEventListener("orientationchange", () => {
      // Delay resize to let orientation change complete
      setTimeout(this.handleResize, 300);
      
      // Add an additional delayed resize to handle viewport stabilization
      setTimeout(this.handleResize, 600);
    });
  }

  /**
   * Event handler for canvas clicks
   */
  private handleCanvasClick = (_e: MouseEvent): void => {
    if (!this.chart) return;

    // Get the hovered sensor from the chart
    const hoveredSensor = (this.chart as any)["hoveredSensor"];
    if (hoveredSensor) {
      this.chart.toggleSensor(hoveredSensor);
      this.updateClearButtonVisibility();

      // Dispatch event for external components to react
      this.dispatchEvent(
        new CustomEvent("sensor-toggled", {
          bubbles: true,
          detail: {
            sensorMac: hoveredSensor,
            active: this.chart.isSensorActive(hoveredSensor),
          },
        }),
      );
    }
  };

  /**
   * Event handler for clear button clicks
   */
  private handleClearClick = (): void => {
    if (!this.chart) return;

    // Get active sensors before clearing
    const activeSensors = this.chart.getActiveSensors();

    // Clear all active sensors
    this.chart.clearActiveSensors();
    this.updateClearButtonVisibility();

    // Notify about cleared sensors
    this.dispatchEvent(
      new CustomEvent("sensors-cleared", {
        bubbles: true,
        detail: {
          sensorMacs: activeSensors,
        },
      }),
    );
  };

  /**
   * Update clear button visibility based on whether there are active sensors
   */
  private updateClearButtonVisibility(): void {
    if (!this.clearButton || !this.chart) return;

    const hasActiveSensors = this.chart.getActiveSensors().length > 0;
    this.clearButton.style.display = hasActiveSensors ? "block" : "none";
  }

  /**
   * Handle resize events with debouncing
   */
  private handleResize = (): void => {
    // Debounce resize events
    if (this.resizeTimeout) {
      window.clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = window.setTimeout(() => {
      if (this.chart) {
        this.chart.resize();
        
        // Add a second resize after a delay to handle any viewport size stabilization
        setTimeout(() => {
          if (this.chart) {
            this.chart.resize();
          }
        }, 250);
      }
      this.resizeTimeout = null;
    }, 150);
  };

  /**
   * Set status text and class
   */
  setStatus(status: string): void {
    if (!this.statusIndicator) return;

    this.statusIndicator.textContent =
      status === "connected" ? "Real-time" : status;
    this.statusIndicator.className = `status status-${status}`;
  }

  /**
   * Set the time range for the chart
   */
  setTimeRange(timeRange: TimeRange): void {
    if (!this.chart) return;

    this.chart.setTimeRange(timeRange);
    this.setAttribute("time-range", timeRange);
  }

  /**
   * Update chart with historical data
   */
  updateData(data: AggregatedSensorData[]): void {
    if (!this.chart) return;

    this.chart.updateData(data);
  }

  /**
   * Update a single data point
   */
  updateValue(
    sensorMac: string,
    timestamp: number,
    temperature?: number | null,
    humidity?: number | null,
    temperatureMin?: number | null,
    temperatureMax?: number | null,
    humidityMin?: number | null,
    humidityMax?: number | null,
  ): void {
    if (!this.chart) return;

    this.chart.updateValue(
      sensorMac,
      timestamp,
      temperature,
      humidity,
      temperatureMin,
      temperatureMax,
      humidityMin,
      humidityMax,
    );
  }

  /**
   * Set the hovered sensor
   */
  setHoveredSensor(sensorMac: string | null): void {
    if (!this.chart) return;

    this.chart.setHoveredSensor(sensorMac);
  }

  /**
   * Toggle a sensor's active state
   */
  toggleSensor(sensorMac: string): void {
    if (!this.chart) return;

    this.chart.toggleSensor(sensorMac);
    this.updateClearButtonVisibility();
  }

  /**
   * Check if a sensor is active
   */
  isSensorActive(sensorMac: string): boolean {
    return this.chart ? this.chart.isSensorActive(sensorMac) : false;
  }

  /**
   * Get all active sensors
   */
  getActiveSensors(): string[] {
    return this.chart ? this.chart.getActiveSensors() : [];
  }

  /**
   * Clear all active sensors
   */
  clearActiveSensors(): void {
    if (!this.chart) return;

    this.chart.clearActiveSensors();
    this.updateClearButtonVisibility();
  }

  /**
   * Force a resize of the chart
   */
  resize(): void {
    if (!this.chart) return;

    // Initial resize
    this.chart.resize();
    
    // Secondary resize after a delay to ensure proper rendering
    // This helps with viewport-based sizing which can take time to stabilize
    setTimeout(() => {
      if (this.chart) {
        this.chart.resize();
      }
    }, 200);
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string,
  ): void {
    if (oldValue === newValue) return;

    switch (name) {
      case "show-humidity":
        this.config.showHumidity = newValue !== "false";
        // Update chart if it exists
        if (this.chart) {
          // We can't change this on the fly in the current implementation
          // Would need to recreate the chart
          console.warn("Changing show-humidity requires recreating the chart");
        }
        break;

      case "show-min-max":
        this.config.showMinMaxBands = newValue !== "false";
        // Update chart if it exists
        if (this.chart) {
          // We can't change this on the fly in the current implementation
          console.warn("Changing show-min-max requires recreating the chart");
        }
        break;

      case "time-range":
        if (this.chart && newValue) {
          this.chart.setTimeRange(newValue as TimeRange);
        }
        break;
    }
  }

  /**
   * Clean up resources when removed from DOM
   */
  disconnectedCallback(): void {
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener("click", this.handleCanvasClick);
    }

    if (this.clearButton) {
      this.clearButton.removeEventListener("click", this.handleClearClick);
    }

    window.removeEventListener("resize", this.handleResize);

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear any pending timeouts
    if (this.resizeTimeout) {
      window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    // Clear references
    this.canvas = null;
    this.controlsContainer = null;
    this.clearButton = null;
    this.statusIndicator = null;
    this.chart = null;
  }
}

// Register the custom element
customElements.define("chart-element", ChartElement);
