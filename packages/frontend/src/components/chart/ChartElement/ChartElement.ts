/**
 * ChartElement Component
 *
 * A custom element that provides a complete chart implementation
 * with DOM management, rendering, and event handling.
 */

import type { TimeRange, AggregatedSensorData } from "../../../types/index.js";
import { TimeFormatter } from "../../../utils/TimeFormatter.js";
import "./ChartElement.css";

export interface ChartElementConfig {
  showHumidity?: boolean;
  showMinMaxBands?: boolean;
  colors?: string[];
}

export interface ChartDataPoint {
  sensorMac: string;
  timestamp: number;
  temperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  humidityMin?: number;
  humidityMax?: number;
}

export class ChartElement extends HTMLElement {
  // DOM element references
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private controlsContainer: HTMLDivElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private statusIndicator: HTMLSpanElement | null = null;

  // Chart state
  private hoveredSensor: string | null = null;
  private data: Map<string, ChartDataPoint[]> = new Map();
  private timeRange: TimeRange = "day";
  private activeSensors = new Set<string>();
  private devicePixelRatio: number = 1;
  private isResizing: boolean = false;

  // Chart bounds
  private temperatureBounds = { minY: 0, maxY: 25 };
  private humidityBounds = { minY: 0, maxY: 100 };
  private timeBounds = { minX: 0, maxX: 0 };

  // Configuration
  private config: ChartElementConfig = {
    showHumidity: true,
    showMinMaxBands: true,
    colors: ["#fff"],
  };

  // Chart configuration
  private chartConfig = {
    padding: {
      top: 20,
      right: 60,
      bottom: 40,
      left: 60,
    },
    gridLines: {
      horizontal: 5,
      vertical: 6,
    },
    width: 0,
    height: 0,
  };

  static get observedAttributes() {
    return ["show-humidity", "show-min-max", "time-range"];
  }

  // Constants for sizing calculations
  private readonly HEADER_HEIGHT = 60;
  private readonly BOTTOM_MARGIN = 20;
  private readonly MIN_HEIGHT = 300;

  constructor() {
    super();
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

    // Initial size calculation
    this.setSize();
  }

  /**
   * Create the DOM structure
   */
  private render(): void {
    // Clear existing content
    this.innerHTML = "";

    // Create controls container
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "chart-controls";

    // Create clear button
    this.clearButton = document.createElement("button");
    this.clearButton.id = "clear-selection-btn";
    this.clearButton.className = "btn btn-secondary";
    this.clearButton.textContent = "Clear";
    this.clearButton.style.display = "none"; // Hidden by default
    this.clearButton.type = "button";

    this.controlsContainer.appendChild(this.clearButton);
    this.appendChild(this.controlsContainer);

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.id = "chart";
    this.appendChild(this.canvas);

    // Create status indicator
    const statusContainer = document.createElement("div");
    statusContainer.className = "chart-status";

    this.statusIndicator = document.createElement("span");
    this.statusIndicator.id = "status-indicator";
    this.statusIndicator.className = "status";
    this.statusIndicator.textContent = "Connecting";
    this.statusIndicator.style.position = "relative";
    this.statusIndicator.style.zIndex = "20";

    statusContainer.appendChild(this.statusIndicator);
    this.appendChild(statusContainer);
  }

  /**
   * Initialize the chart
   */
  private initializeChart(): void {
    if (!this.canvas) return;

    // Get canvas context
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    if (!this.ctx) return;

    // Apply any attributes that were set before initialization
    if (this.hasAttribute("time-range")) {
      this.timeRange = this.getAttribute("time-range") as TimeRange;
    }

    // Initial canvas setup
    this.setupCanvas();
    
    // Initial render with empty data - this will calculate bounds internally
    this.drawChart();
    
    // Delayed resize to ensure proper layout after DOM is settled
    setTimeout(() => this.resize(), 100);
  }

  /**
   * Set up the canvas with proper dimensions
   */
  private setupCanvas(): void {
    if (!this.canvas || !this.ctx) return;

    // Get device pixel ratio for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    this.devicePixelRatio = dpr;

    // Get container width
    const containerWidth = Math.floor(
      this.canvas.clientWidth || this.canvas.width,
    );
    const containerHeight = Math.floor(
      this.canvas.clientHeight || this.canvas.height,
    );

    // Only update if dimensions have changed (avoid unnecessary redraws)
    if (this.chartConfig.width !== containerWidth || 
        this.chartConfig.height !== containerHeight) {

      // Set display size (css pixels)
      this.canvas.style.width = `${containerWidth}px`;
      this.canvas.style.height = `${containerHeight}px`;

      // Set actual size in memory (scaled for high DPI displays)
      this.canvas.width = Math.floor(containerWidth * dpr);
      this.canvas.height = Math.floor(containerHeight * dpr);

      // Store dimensions for calculations
      this.chartConfig.width = containerWidth;
      this.chartConfig.height = containerHeight;
    }

    // Reset and then apply scale for high DPI displays
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    // Enable crisp lines for better rendering
    this.ctx.imageSmoothingEnabled = false;
    
    // Use crisp pixel-aligned lines for grid
    this.ctx.translate(0.5, 0.5);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Canvas click for sensor selection
    if (this.canvas) {
      this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));
    }

    // Clear button events
    if (this.clearButton) {
      this.clearButton.addEventListener(
        "click",
        this.handleClearClick.bind(this),
        {
          capture: true,
        },
      );

      // Mobile touch events
      this.clearButton.addEventListener(
        "touchstart",
        this.stopDead.bind(this),
        { passive: false },
      );

      this.clearButton.addEventListener(
        "touchend",
        (e: TouchEvent) => {
          this.stopDead(e);
          this.handleClearClick.call(this, e as unknown as MouseEvent);
        },
        { passive: false },
      );
    }
  }

  private setSize(): void {
    if (this.canvas) {
      const availableHeight =
        window.innerHeight - this.HEADER_HEIGHT - this.BOTTOM_MARGIN;
      const height = Math.max(availableHeight, this.MIN_HEIGHT);
      
      // Set explicit width and height
      this.canvas.style.height = `${height}px`;
      this.canvas.style.width = '100%';
      
      // Force immediate layout update
      this.canvas.getBoundingClientRect();
    }
  }

  /**
   * Event handler for canvas clicks
   */
  private handleCanvasClick(_e: MouseEvent): void {
    // Use the tracked hovered sensor
    if (this.hoveredSensor) {
      this.toggleSensor(this.hoveredSensor);
      this.updateClearButtonVisibility();

      // Dispatch event for external components to react
      this.dispatchEvent(
        new CustomEvent("sensor-toggled", {
          bubbles: true,
          detail: {
            sensorMac: this.hoveredSensor,
            active: this.isSensorActive(this.hoveredSensor),
          },
        }),
      );
    }
  }

  /**
   * Event handler for clear button clicks
   */
  private handleClearClick(e: MouseEvent): void {
    // Prevent event propagation and default behavior
    e.stopPropagation();
    e.preventDefault();

    // Get active sensors before clearing
    const activeSensors = this.getActiveSensors();

    // Clear all active sensors
    this.clearActiveSensors();

    // Notify about cleared sensors
    this.dispatchEvent(
      new CustomEvent("sensors-cleared", {
        bubbles: true,
        detail: { sensorMacs: activeSensors },
      }),
    );
  }

  /**
   * Update clear button visibility based on whether there are active sensors
   */
  private updateClearButtonVisibility(): void {
    if (!this.clearButton) return;

    const hasActiveSensors = this.activeSensors.size > 0;

    if (hasActiveSensors) {
      this.clearButton.setAttribute(
        "style",
        "display: block; position: relative; z-index: 20; cursor: pointer;",
      );
    } else {
      this.clearButton.style.display = "none";
    }
  }

  /**
   * Set status text and class
   */
  setStatus(status: string): void {
    if (!this.statusIndicator) return;

    // Set status text with capitalized first letter
    this.statusIndicator.textContent =
      status === "connected"
        ? "Real-time"
        : status.charAt(0).toUpperCase() + status.slice(1);
    this.statusIndicator.className = `status status-${status}`;

    // Ensure indicator is visible
    this.statusIndicator.style.visibility = "visible";
    this.statusIndicator.style.opacity = "1";
    this.statusIndicator.style.zIndex = "25";
  }

  /**
   * Set the time range for the chart
   */
  setTimeRange(timeRange: TimeRange): void {
    this.timeRange = timeRange;
    this.setAttribute("time-range", timeRange);
    this.calculateBounds();
    this.render();
  }

  /**
   * Update chart with historical data
   */
  updateData(data: AggregatedSensorData[]): void {
    // Clear existing data
    this.data.clear();

    // Group data by sensor
    data.forEach((point) => {
      if (!this.data.has(point.sensorMac)) {
        this.data.set(point.sensorMac, []);
      }

      const dataPoint: ChartDataPoint = {
        sensorMac: point.sensorMac,
        timestamp: point.timestamp,
      };

      if (point.avgTemperature !== null) {
        dataPoint.temperature = point.avgTemperature;

        // Add min/max temperature if available
        if (
          point.minTemperature !== null &&
          point.minTemperature !== undefined
        ) {
          dataPoint.temperatureMin = point.minTemperature;
        }

        if (
          point.maxTemperature !== null &&
          point.maxTemperature !== undefined
        ) {
          dataPoint.temperatureMax = point.maxTemperature;
        }
      }

      if (point.avgHumidity !== null && this.config.showHumidity) {
        dataPoint.humidity = point.avgHumidity;

        // Add min/max humidity if available
        if (point.minHumidity !== null && point.minHumidity !== undefined) {
          dataPoint.humidityMin = point.minHumidity;
        }

        if (point.maxHumidity !== null && point.maxHumidity !== undefined) {
          dataPoint.humidityMax = point.maxHumidity;
        }
      }

      const points = this.data.get(point.sensorMac);
      if (points) {
        points.push(dataPoint);
      }
    });

    // Sort each sensor's data by timestamp
    this.data.forEach((points) => {
      points.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    // If we have data now, trigger a full redraw
    // Only render when new data arrives
    if (data.length > 0) {
      this.drawChart();
    }
  }

  /**
   * Update a single data point and redraw the chart
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
    const points = this.data.get(sensorMac);
    const point: ChartDataPoint = { sensorMac, timestamp };

    if (temperature !== undefined && temperature !== null) {
      point.temperature = temperature;
      point.temperatureMin = temperature;
      point.temperatureMax = temperature;
    }
    if (humidity !== undefined && humidity !== null) {
      point.humidity = humidity;
      point.humidityMin = humidity;
      point.humidityMax = humidity;
    }
    if (temperatureMin !== undefined && temperatureMin !== null)
      point.temperatureMin = temperatureMin;
    if (temperatureMax !== undefined && temperatureMax !== null)
      point.temperatureMax = temperatureMax;
    if (humidityMin !== undefined && humidityMin !== null)
      point.humidityMin = humidityMin;
    if (humidityMax !== undefined && humidityMax !== null)
      point.humidityMax = humidityMax;

    if (points) {
      // Find existing point at same timestamp or add new one
      const lastTimestamp = points[points.length - 1]?.timestamp;
      const secondLastTimestamp = points[points.length - 2]?.timestamp;
      const bucketSize =
        lastTimestamp === undefined || secondLastTimestamp === undefined
          ? 30
          : lastTimestamp - secondLastTimestamp;
      const existingIndex = points.findIndex(
        (p) => timestamp - p.timestamp < bucketSize,
      );
      if (existingIndex >= 0 && points[existingIndex]) {
        if (temperature !== undefined && temperature !== null) {
          points[existingIndex].temperature = temperature;
        }

        if (humidity !== undefined && humidity !== null) {
          points[existingIndex].humidity = humidity;
        }

        if (point.humidityMin !== undefined && point.humidityMin !== null) {
          points[existingIndex].humidityMin =
            points[existingIndex].humidityMin !== undefined
              ? Math.min(points[existingIndex].humidityMin!, point.humidityMin)
              : point.humidityMin;
        }

        if (point.humidityMax !== undefined && point.humidityMax !== null) {
          points[existingIndex].humidityMax =
            points[existingIndex].humidityMax !== undefined
              ? Math.max(points[existingIndex].humidityMax!, point.humidityMax)
              : point.humidityMax;
        }
      } else {
        points.push(point);
        points.sort((a, b) => a.timestamp - b.timestamp);
      }
    } else {
      this.data.set(sensorMac, [point]);
    }

    // Just call drawChart - bounds will be calculated within it
    this.drawChart();
  }

  /**
   * Set the hovered sensor
   */
  setHoveredSensor(sensorMac: string | null): void {
    this.hoveredSensor = sensorMac;
    // Only redraw when hovering changes
    this.drawChart();
  }

  /**
   * Toggle a sensor's active state
   */
  toggleSensor(sensorMac: string): void {
    if (this.activeSensors.has(sensorMac)) {
      this.activeSensors.delete(sensorMac);
    } else {
      this.activeSensors.add(sensorMac);
    }

    this.updateClearButtonVisibility();
    // Redraw after sensor activation state changes
    this.drawChart();
  }

  /**
   * Check if a sensor is active
   */
  isSensorActive(sensorMac: string): boolean {
    return this.activeSensors.has(sensorMac);
  }

  /**
   * Get all active sensors
   */
  getActiveSensors(): string[] {
    return Array.from(this.activeSensors);
  }

  /**
   * Clear all active sensors
   */
  clearActiveSensors(): void {
    this.activeSensors.clear();
    this.updateClearButtonVisibility();
    // Redraw after clearing active sensors
    this.drawChart();
  }

  /**
   * Calculate chart data bounds
   */
  private calculateBounds(): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minTempY = Infinity;
    let maxTempY = -Infinity;

    this.data.forEach((points) => {
      points.forEach((point) => {
        minX = Math.min(minX, point.timestamp);
        maxX = Math.max(maxX, point.timestamp);

        if (point.temperature !== undefined) {
          minTempY = Math.min(minTempY, point.temperature);
          maxTempY = Math.max(maxTempY, point.temperature);
        }
      });
    });

    // Set current time range for X axis even when no data
    const now = Date.now() / 1000;
    let timeRangeSeconds: number;
    
    switch (this.timeRange) {
      case "hour": timeRangeSeconds = 60 * 60; break;
      case "day": timeRangeSeconds = 24 * 60 * 60; break;
      case "week": timeRangeSeconds = 7 * 24 * 60 * 60; break;
      case "month": timeRangeSeconds = 30 * 24 * 60 * 60; break;
      case "year": timeRangeSeconds = 365 * 24 * 60 * 60; break;
      default: timeRangeSeconds = 24 * 60 * 60; // Default to day
    }
    
    // Time bounds
    this.timeBounds = {
      minX: minX === Infinity ? now - timeRangeSeconds : minX,
      maxX: maxX === -Infinity ? now : maxX,
    };

    // Temperature bounds with padding
    const tempPadding = (maxTempY - minTempY) * 0.1 || 1;
    this.temperatureBounds = {
      minY:
        minTempY === Infinity
          ? 0
          : Math.floor((minTempY - tempPadding) / 5) * 5,
      maxY:
        maxTempY === -Infinity
          ? 25
          : Math.ceil((maxTempY + tempPadding) / 5) * 5,
    };

    // Humidity bounds (default 0-100% but can be narrowed if data allows)
    if (this.config.showHumidity) {
      this.humidityBounds = {
        minY: 0.0,
        maxY: 100.0,
      };
    }
  }

  /**
   * Public resize method that can be called from outside
   * On resize, only adjust canvas size and styles, then redraw
   */
  public resize(): void {
    if (!this.canvas || !this.ctx) return;

    // Prevent resize loops
    if (this.isResizing) return;

    try {
      this.isResizing = true;

      // Update size
      this.setSize();

      // Reconfigure canvas for the new size (only adjust canvas and its styles)
      this.setupCanvas();
      
      // Redraw chart with current data
      this.drawChart();

      if (this.statusIndicator) {
        this.statusIndicator.style.visibility = "visible";
        this.statusIndicator.style.opacity = "1";
      }
    } finally {
      this.isResizing = false;
    }
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
        this.drawChart();
        break;

      case "show-min-max":
        this.config.showMinMaxBands = newValue !== "false";
        this.drawChart();
        break;

      case "time-range":
        if (newValue) {
          this.timeRange = newValue as TimeRange;
          this.drawChart();
        }
        break;
    }
  }

  /**
   * Main chart drawing method
   * This is the single point of rendering - called when:
   * 1. Chart is created
   * 2. Window is resized (only adjusts canvas and styles before drawing)
   * 3. New data arrives
   */
  private drawChart(): void {
    if (!this.ctx || !this.canvas) return;

    // Ensure we have valid dimensions before rendering
    if (
      !this.chartConfig.width ||
      !this.chartConfig.height ||
      this.chartConfig.width <= 0 ||
      this.chartConfig.height <= 0
    ) {
      return; // Skip rendering if dimensions are invalid
    }
    
    // Always calculate bounds before drawing to ensure proper rendering
    this.calculateBounds();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Reset any lingering transforms for consistency
    const dpr = this.devicePixelRatio;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    // Always draw grid and labels, even if no data
    this.drawGrid();
    this.drawLabels();

    // If no data, stop here - we've drawn the grid and labels
    if (this.data.size === 0) {
      // Maybe draw a "No Data" message
      this.drawNoDataMessage();
      return;
    }
    
    // Draw data lines
    const sortedSensors = Array.from(this.data.keys()).sort();
    const hasHoveredSensor = this.hoveredSensor !== null;

    // Draw non-hovered, non-active sensors first (background)
    sortedSensors.forEach((sensorMac, index) => {
      const points = this.data.get(sensorMac)!;
      const color =
        this.config.colors?.[index % (this.config.colors?.length || 1)] ||
        "#4a9eff";
      const isHovered = this.hoveredSensor === sensorMac;
      const isActive = this.activeSensors.has(sensorMac);

      // Determine dimming logic:
      // 1. If any sensors are active, dim non-active and non-hovered sensors
      // 2. If no sensors are active but one is hovered, dim all other sensors
      const shouldDim =
        (this.activeSensors.size > 0 && !isActive && !isHovered) ||
        (this.activeSensors.size === 0 && hasHoveredSensor && !isHovered);

      // When hovering over a sensor, keep active sensors highlighted
      const opacity = shouldDim ? 0.15 : 1;

      // Skip drawing highlighted sensors on first pass
      if (isHovered || isActive) return;

      // Draw temperature line (solid)
      this.drawTemperatureLine(points, color, opacity, isHovered);

      // Draw humidity line (dotted) if enabled
      if (this.config.showHumidity) {
        this.drawHumidityLine(points, color, opacity, isHovered);
      }
    });

    // Now draw active and hovered sensors on top (foreground)
    sortedSensors.forEach((sensorMac, index) => {
      const points = this.data.get(sensorMac)!;
      const color =
        this.config.colors?.[index % (this.config.colors?.length || 1)] ||
        "#4a9eff";
      const isHovered = this.hoveredSensor === sensorMac;
      const isActive = this.activeSensors.has(sensorMac);

      // Skip if not highlighted
      if (!isHovered && !isActive) return;

      // Draw temperature line (solid)
      this.drawTemperatureLine(points, color, 1, isHovered);

      // Draw humidity line (dotted) if enabled
      if (this.config.showHumidity) {
        this.drawHumidityLine(points, color, 1, isHovered);
      }
    });
  }
  
  /**
   * Draw a message when no data is available
   */
  private drawNoDataMessage(): void {
    if (!this.ctx || !this.chartConfig.width || !this.chartConfig.height) return;
    
    const width = this.chartConfig.width;
    const height = this.chartConfig.height;
    
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.font = "14px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("Waiting for sensor data...", width / 2, height / 2);
    
    // Add borders to ensure chart area is visible
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(
      this.chartConfig.padding.left, 
      this.chartConfig.padding.top, 
      width - this.chartConfig.padding.left - this.chartConfig.padding.right,
      height - this.chartConfig.padding.top - this.chartConfig.padding.bottom
    );
  }

  /**
   * Draw the grid
   */
  private drawGrid(): void {
    if (!this.ctx || !this.chartConfig.width || !this.chartConfig.height)
      return;

    const { padding, gridLines } = this.chartConfig;
    const width = this.chartConfig.width;
    const height = this.chartConfig.height;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Ensure we have proper dimensions
    if (chartWidth <= 0 || chartHeight <= 0) return;

    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);

    // Horizontal grid lines
    for (let i = 0; i <= gridLines.horizontal; i++) {
      const y = padding.top + (i * chartHeight) / gridLines.horizontal;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(width - padding.right, y);
      this.ctx?.stroke();
    }

    // Vertical grid lines - aligned with exact time intervals
    const timeBoundaries = this.calculateTimeBoundaries();

    timeBoundaries.forEach((timestamp) => {
      // Calculate x position based on timestamp
      const x =
        padding.left +
        ((timestamp - this.timeBounds.minX) /
          (this.timeBounds.maxX - this.timeBounds.minX)) *
          chartWidth;

      // Only draw if within chart area
      if (x >= padding.left && x <= width - padding.right) {
        if (this.ctx) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, padding.top);
          this.ctx.lineTo(x, height - padding.bottom);
          this.ctx?.stroke();
        }
      }
    });

    this.ctx.setLineDash([]);
  }

  /**
   * Draw chart labels (axes, timestamps, values)
   */
  private drawLabels(): void {
    if (!this.ctx || !this.chartConfig.width || !this.chartConfig.height)
      return;

    const { padding, gridLines } = this.chartConfig;
    const width = this.chartConfig.width;
    const height = this.chartConfig.height;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Ensure we have proper dimensions
    if (chartWidth <= 0 || chartHeight <= 0) return;

    // Set label text size based on chart height
    this.ctx.fillStyle = "#aaa";
    this.ctx.font = "12px monospace";
    this.ctx.textBaseline = "middle";

    // X-axis labels (time) - aligned with exact time intervals
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    const timeBoundaries = this.calculateTimeBoundaries();

    timeBoundaries.forEach((timestamp) => {
      // Calculate x position based on timestamp
      const x =
        padding.left +
        ((timestamp - this.timeBounds.minX) /
          (this.timeBounds.maxX - this.timeBounds.minX)) *
          chartWidth;

      // Only draw if within chart area
      if (x >= padding.left && x <= width - padding.right) {
        const label = TimeFormatter.formatTimeLabel(timestamp, this.timeRange);
        this.ctx?.fillText(label, x, height - padding.bottom + 5);
      }
    });

    // Temperature Y-axis labels (left side)
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    for (let i = 0; i <= gridLines.horizontal; i++) {
      const y = padding.top + (i * chartHeight) / gridLines.horizontal;
      const value =
        this.temperatureBounds.maxY -
        (i * (this.temperatureBounds.maxY - this.temperatureBounds.minY)) /
          gridLines.horizontal;
      const label = `${value.toFixed(1)}°C`;
      this.ctx.fillText(label, padding.left - 8, y);
    }

    // Humidity Y-axis labels (right side)
    if (this.config.showHumidity) {
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      // Use same color as temperature labels for consistency
      this.ctx.fillStyle = "#999";

      // Only show humidity labels for a subset of lines to avoid clutter
      const humidityGridHeight = chartHeight / gridLines.horizontal;
      const humidityPaddingTop =
        padding.top + humidityGridHeight * (gridLines.horizontal - 2);
      const humidityLines = Math.min(3, gridLines.horizontal);

      for (let i = 0; i <= humidityLines; i++) {
        const y = humidityPaddingTop + i * humidityGridHeight;
        const value =
          this.humidityBounds.maxY -
          (i * (this.humidityBounds.maxY - this.humidityBounds.minY)) /
            (humidityLines - 1);
        const label = `${value.toFixed(0)}%`;
        this.ctx.fillText(label, width - padding.right + 8, y);
      }
    }
  }

  /**
   * Draw temperature line for a sensor
   */
  private drawTemperatureLine(
    points: ChartDataPoint[],
    color: string,
    opacity: number,
    isHovered: boolean,
  ): void {
    const tempPoints = points.filter((p) => p.temperature !== undefined);
    if (tempPoints.length === 0) return;

    if (!this.ctx || !this.chartConfig.width || !this.chartConfig.height)
      return;

    const { padding } = this.chartConfig;
    const width = this.chartConfig.width;
    const height = this.chartConfig.height;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Safety check for invalid dimensions
    if (chartWidth <= 0 || chartHeight <= 0) return;

    const sensorMac = tempPoints[0]!.sensorMac;
    const isActive = this.activeSensors.has(sensorMac);

    // Increase opacity for active or hovered sensor
    const effectiveOpacity = isActive || isHovered ? 1.0 : opacity;

    // Adjust line widths for high-DPI displays and maintain visual hierarchy
    const baseWidth = this.devicePixelRatio > 1 ? 0.8 : 1;
    const lineWidth = isHovered
      ? 3 * baseWidth
      : isActive
        ? 2 * baseWidth
        : 1.5 * baseWidth;

    // Apply line width to canvas context
    this.ctx.lineWidth = lineWidth;

    // Function to calculate x coordinate
    const getX = (timestamp: number) =>
      padding.left +
      ((timestamp - this.timeBounds.minX) /
        (this.timeBounds.maxX - this.timeBounds.minX)) *
        chartWidth;

    // Function to calculate y coordinate for temperature
    const getY = (temp: number) =>
      padding.top +
      ((this.temperatureBounds.maxY - temp) /
        (this.temperatureBounds.maxY - this.temperatureBounds.minY)) *
        chartHeight;

    // Draw min-max area if available and enabled
    const hasMinMax = tempPoints.some(
      (p) => p.temperatureMin !== undefined && p.temperatureMax !== undefined,
    );

    if (hasMinMax && this.config.showMinMaxBands) {
      // Create area between min and max
      this.ctx?.beginPath();

      // Draw forward path (max values)
      tempPoints.forEach((point, index) => {
        const x = getX(point.timestamp);
        // Use max if available, otherwise fall back to the main temperature value
        const maxTemp =
          point.temperatureMax !== undefined
            ? point.temperatureMax
            : point.temperature!;
        const y = getY(maxTemp);

        if (index === 0) {
          this.ctx?.moveTo(x, y);
        } else {
          this.ctx?.lineTo(x, y);
        }
      });

      // Draw backward path (min values)
      for (let i = tempPoints.length - 1; i >= 0; i--) {
        const point = tempPoints[i]!;
        const x = getX(point.timestamp);
        // Use min if available, otherwise fall back to the main temperature value
        const minTemp =
          point.temperatureMin !== undefined
            ? point.temperatureMin
            : point.temperature!;
        const y = getY(minTemp);

        this.ctx?.lineTo(x, y);
      }

      // Close and fill the path
      this.ctx?.closePath();
      if (this.ctx) {
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = effectiveOpacity * 0.25; // Transparent fill for the area
        this.ctx.fill();

        // Reset alpha for the main line
        this.ctx.globalAlpha = effectiveOpacity;
      }
    }

    // Draw main line
    if (this.ctx) {
      this.ctx.strokeStyle = color;
      this.ctx.globalAlpha = effectiveOpacity;
      this.ctx.lineWidth = isHovered || isActive ? 3 : 2;
      this.ctx.lineJoin = "round";
      this.ctx.lineCap = "round";
      this.ctx.setLineDash([]);

      this.ctx.beginPath();
    }
    tempPoints.forEach((point, index) => {
      const x = getX(point.timestamp);
      const y = getY(point.temperature!);

      if (index === 0) {
        this.ctx?.moveTo(x, y);
      } else {
        this.ctx?.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered or active
    if (isHovered || (isActive && this.ctx)) {
      this.ctx.fillStyle = color;
      tempPoints.forEach((point) => {
        const x = getX(point.timestamp);
        const y = getY(point.temperature!);

        this.ctx?.beginPath();
        this.ctx?.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx?.fill();
      });
    }

    if (this.ctx) {
      this.ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw humidity line for a sensor
   */
  private drawHumidityLine(
    points: ChartDataPoint[],
    color: string,
    opacity: number,
    isHovered: boolean,
  ): void {
    const humidityPoints = points.filter((p) => p.humidity !== undefined);
    if (humidityPoints.length === 0) return;

    if (!this.ctx || !this.chartConfig.width || !this.chartConfig.height)
      return;

    const { padding } = this.chartConfig;
    const width = this.chartConfig.width;
    const height = this.chartConfig.height;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    // Humidity's y-axis is not as tall as the temperatures - to keep them less overlapped
    const humidityGridHeight =
      chartHeight / this.chartConfig.gridLines.horizontal;
    const humidityChartHeight = humidityGridHeight * 2;
    const humidityPaddingTop =
      padding.top +
      humidityGridHeight * (this.chartConfig.gridLines.horizontal - 2);

    const sensorMac = humidityPoints[0]!.sensorMac;
    const isActive = this.activeSensors.has(sensorMac);

    // Reduce overall opacity for humidity to make it secondary to temperature
    // Humidity should still be visible but clearly secondary
    const baseOpacity = 0.7; // Base multiplier for all humidity visualization
    const effectiveOpacity =
      isActive || isHovered ? baseOpacity : opacity * baseOpacity;

    // Slightly reduce line width compared to temperature for visual hierarchy
    // Adjust for high-DPI displays
    const baseWidth = this.devicePixelRatio > 1 ? 0.8 : 1;
    const lineWidth = isHovered
      ? 2 * baseWidth
      : isActive
        ? 1.75 * baseWidth
        : 1.25 * baseWidth;

    // Apply line width to canvas context
    this.ctx.lineWidth = lineWidth;

    // Function to calculate x coordinate
    const getX = (timestamp: number) =>
      padding.left +
      ((timestamp - this.timeBounds.minX) /
        (this.timeBounds.maxX - this.timeBounds.minX)) *
        chartWidth;

    // Function to calculate y coordinate for humidity
    const getY = (humidity: number) =>
      humidityPaddingTop +
      ((this.humidityBounds.maxY - humidity) /
        (this.humidityBounds.maxY - this.humidityBounds.minY)) *
        humidityChartHeight;

    // Draw min-max area if available and enabled
    const hasMinMax = humidityPoints.some(
      (p) => p.humidityMin !== undefined && p.humidityMax !== undefined,
    );

    if (hasMinMax && this.config.showMinMaxBands) {
      // Create area between min and max
      this.ctx.beginPath();

      // Draw forward path (max values)
      humidityPoints.forEach((point, index) => {
        const x = getX(point.timestamp);
        // Use max if available, otherwise fall back to the main humidity value
        const maxHumidity =
          point.humidityMax !== undefined ? point.humidityMax : point.humidity!;
        const y = getY(maxHumidity);

        if (index === 0) {
          this.ctx?.moveTo(x, y);
        } else {
          this.ctx?.lineTo(x, y);
        }
      });

      // Draw backward path (min values)
      for (let i = humidityPoints.length - 1; i >= 0; i--) {
        const point = humidityPoints[i]!;
        const x = getX(point.timestamp);
        // Use min if available, otherwise fall back to the main humidity value
        const minHumidity =
          point.humidityMin !== undefined ? point.humidityMin : point.humidity!;
        const y = getY(minHumidity);

        this.ctx?.lineTo(x, y);
      }

      // Close and fill the path
      this.ctx?.closePath();
      if (this.ctx) {
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = effectiveOpacity * 0.15; // More transparent fill for humidity area
        this.ctx.fill();
      }
    }

    // Draw main line
    if (this.ctx) {
      this.ctx.strokeStyle = color;
      this.ctx.globalAlpha = effectiveOpacity * 0.6; // More transparent for secondary priority
      this.ctx.lineWidth = isHovered || isActive ? 2.5 : 1.75; // Thinner than temperature lines
      this.ctx.lineJoin = "round";
      this.ctx.lineCap = "round";
      // More pronounced dash pattern for better visibility
      this.ctx.setLineDash(isHovered || isActive ? [8, 4] : [6, 3]); // Larger dash pattern, especially when active

      this.ctx.beginPath();
    }
    humidityPoints.forEach((point, index) => {
      const x = getX(point.timestamp);
      const y = getY(point.humidity!);

      if (index === 0) {
        this.ctx?.moveTo(x, y);
      } else {
        this.ctx?.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered or active
    if (isHovered || (isActive && this.ctx)) {
      // Reset line dash for points
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = effectiveOpacity * 0.8; // Make points more visible than lines but still secondary
      humidityPoints.forEach((point) => {
        const x = getX(point.timestamp);
        const y = getY(point.humidity!);

        this.ctx?.beginPath();
        this.ctx?.arc(x, y, 3, 0, 2 * Math.PI); // Slightly smaller points than temperature
        this.ctx?.fill();
      });
    }

    if (this.ctx) {
      this.ctx.globalAlpha = 1;
      this.ctx.setLineDash([]);
    }
  }

  /**
   * Calculate time boundaries for grid lines and labels
   */
  private calculateTimeBoundaries(): number[] {
    const boundaries: number[] = [];
    const minTime = this.timeBounds.minX;
    const maxTime = this.timeBounds.maxX;

    let interval: number;
    let roundTo: number;
    let startOffset: number = 0;

    // Set interval based on time range
    switch (this.timeRange) {
      case "hour":
        // Every 10 minutes
        interval = 10 * 60; // 10 minutes in seconds
        roundTo = 60; // Round to nearest minute
        break;

      case "day":
        // Every 3 hours
        interval = 3 * 60 * 60; // 3 hours in seconds
        roundTo = 60 * 60; // Round to nearest hour
        break;

      case "week":
        // Noon each day
        interval = 24 * 60 * 60; // 24 hours in seconds
        roundTo = 60 * 60; // Round to nearest hour

        // Find the noon timestamp for each day
        const dayStart = new Date(minTime * 1000);
        dayStart.setHours(12, 0, 0, 0); // Set to noon
        startOffset = dayStart.getTime() / 1000 - minTime;
        break;

      case "month":
        // Every 5 days
        interval = 5 * 24 * 60 * 60; // 5 days in seconds
        roundTo = 24 * 60 * 60; // Round to nearest day

        // Find the start of the day
        const monthStart = new Date(minTime * 1000);
        monthStart.setHours(0, 0, 0, 0);

        // Get to a day divisible by 5
        const dayOfMonth = monthStart.getDate();
        const daysToAdd = 5 - (dayOfMonth % 5);
        if (daysToAdd < 5) {
          monthStart.setDate(dayOfMonth + daysToAdd);
        }

        startOffset = monthStart.getTime() / 1000 - minTime;
        break;

      case "year":
        // First day of each month
        interval = 30 * 24 * 60 * 60; // ~30 days in seconds (approximate)

        // Find the 1st of the next month
        const yearStart = new Date(minTime * 1000);
        yearStart.setDate(1); // Set to 1st of month
        yearStart.setHours(0, 0, 0, 0);

        // Move to next month if we're already past the 1st
        if (yearStart.getTime() / 1000 < minTime) {
          yearStart.setMonth(yearStart.getMonth() + 1);
        }

        startOffset = yearStart.getTime() / 1000 - minTime;

        // For year view, we need to generate timestamps for the 1st of each month
        const endDate = new Date(maxTime * 1000);
        const currentDate = new Date(yearStart.getTime());

        while (currentDate <= endDate) {
          boundaries.push(currentDate.getTime() / 1000);
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return boundaries; // Return early for year view

      default:
        interval = 60 * 60; // Default to hourly
        roundTo = 60;
    }

    // Calculate the start time rounded to the appropriate interval
    let startTime: number;

    if (startOffset > 0) {
      // If we have a specific offset (like noon for week view)
      startTime = minTime + startOffset;
    } else {
      // Otherwise round to the nearest interval
      startTime = Math.ceil(minTime / roundTo) * roundTo;
    }

    // Generate boundaries
    for (let t = startTime; t <= maxTime; t += interval) {
      boundaries.push(t);
    }

    return boundaries;
  }

  /**
   * Helper method to stop event propagation
   */
  private stopDead(e: TouchEvent): void {
    e.stopPropagation();
    e.preventDefault();
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

      // Remove touch event listeners too
      this.clearButton.removeEventListener("touchstart", this.stopDead);
      this.clearButton.removeEventListener("touchend", (e: TouchEvent) => {
        this.stopDead(e);
        this.handleClearClick.call(this, e as unknown as MouseEvent);
      });
    }

    // Clear references
    this.hoveredSensor = null;
    this.canvas = null;
    this.ctx = null;
    this.controlsContainer = null;
    this.clearButton = null;
    this.statusIndicator = null;
  }
}

// Register the custom element
customElements.define("chart-element", ChartElement);
