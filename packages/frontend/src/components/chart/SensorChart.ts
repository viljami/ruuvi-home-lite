import type { AggregatedSensorData, TimeRange } from "../../types/index.js";
import { TimeFormatter } from "../../utils/TimeFormatter.js";

export interface ChartConfig {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  gridLines: {
    horizontal: number;
    vertical: number;
  };
  colors: string[];
  showHumidity: boolean;
  showMinMaxBands: boolean;
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

export class SensorChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ChartConfig;
  private data: Map<string, ChartDataPoint[]> = new Map();
  private timeRange: TimeRange = "day";
  private hoveredSensor: string | null = null;
  private activeSensors = new Set<string>();
  private devicePixelRatio: number = 1;
  private temperatureBounds = {
    minY: 0,
    maxY: 0,
  };
  private humidityBounds = {
    minY: 0,
    maxY: 100,
  };
  private timeBounds = {
    minX: 0,
    maxX: 0,
  };

  constructor(canvas: HTMLCanvasElement, config: Partial<ChartConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.config = {
      width: config.width || canvas.width,
      height: config.height || canvas.height,
      padding: {
        top: 20,
        right: config.showHumidity !== false ? 60 : 20,
        bottom: 40,
        left: 60,
        ...config.padding,
      },
      gridLines: {
        horizontal: 5,
        vertical: 6,
        ...config.gridLines,
      },
      colors: config.colors || [
        "#4a9eff",
        "#ff6b6b",
        "#4ecdc4",
        "#45b7d1",
        "#96ceb4",
        "#ffeaa7",
      ],
      showHumidity: config.showHumidity !== false,
      showMinMaxBands: config.showMinMaxBands !== false,
    };

    this.setupCanvas();
  }

  private setupCanvas(): void {
    // Set canvas size based on container
    const container = this.canvas.parentElement;
    if (container) {
      // Get the device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;

      // Store dpr for line calculations
      this.devicePixelRatio = dpr;

      // Set display size (css pixels)
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      this.canvas.style.width = `${containerWidth}px`;
      this.canvas.style.height = `${containerHeight}px`;

      // Set actual size in memory (scaled for high DPI displays)
      this.canvas.width = Math.floor(containerWidth * dpr);
      this.canvas.height = Math.floor(containerHeight * dpr);

      // Scale all drawing operations by the dpr
      this.ctx.scale(dpr, dpr);

      // Update config dimensions to logical size (not pixel size)
      this.config.width = containerWidth;
      this.config.height = containerHeight;
    }

    // Enable crisp lines
    this.ctx.imageSmoothingEnabled = false;
  }

  setTimeRange(timeRange: TimeRange): void {
    this.timeRange = timeRange;
  }

  setHoveredSensor(sensorMac: string | null): void {
    this.hoveredSensor = sensorMac;
    this.render();
  }

  toggleSensor(sensorMac: string): void {
    if (this.activeSensors.has(sensorMac)) {
      this.activeSensors.delete(sensorMac);
    } else {
      this.activeSensors.add(sensorMac);
    }
    this.render();
  }

  isSensorActive(sensorMac: string): boolean {
    return this.activeSensors.has(sensorMac);
  }

  updateValue(
    sensorMac: string,
    timestamp: number,
    temperature?: number,
    humidity?: number,
    temperatureMin?: number,
    temperatureMax?: number,
    humidityMin?: number,
    humidityMax?: number,
  ): void {
    const points = this.data.get(sensorMac);
    const point: ChartDataPoint = { sensorMac, timestamp };

    if (temperature !== undefined) {
      point.temperature = temperature;
      point.temperatureMin = temperature;
      point.temperatureMax = temperature;
    }
    if (humidity !== undefined) {
      point.humidity = humidity;
      point.humidityMin = humidity;
      point.humidityMax = humidity;
    }
    if (temperatureMin !== undefined) point.temperatureMin = temperatureMin;
    if (temperatureMax !== undefined) point.temperatureMax = temperatureMax;
    if (humidityMin !== undefined) point.humidityMin = humidityMin;
    if (humidityMax !== undefined) point.humidityMax = humidityMax;

    if (points) {
      // Find existing point at same timestamp or add new one
      const lastTimesampt = points[points.length - 1]?.timestamp;
      const secondLastTimesampt = points[points.length - 2]?.timestamp;
      const bucketSize =
        lastTimesampt === undefined || secondLastTimesampt === undefined
          ? 30
          : lastTimesampt - secondLastTimesampt;
      const existingIndex = points.findIndex(
        (p) => timestamp - p.timestamp < bucketSize,
      );
      if (existingIndex >= 0 && points[existingIndex]) {
        if (temperature !== undefined) {
          points[existingIndex].temperature = temperature;
        }

        if (humidity !== undefined) {
          points[existingIndex].humidity = humidity;
        }

        if (point.humidityMin !== undefined) {
          points[existingIndex].humidityMin =
            points[existingIndex].humidityMin !== undefined
              ? Math.min(points[existingIndex].humidityMin, point.humidityMin)
              : point.humidityMin;
        }

        if (point.humidityMax !== undefined) {
          points[existingIndex].humidityMax =
            points[existingIndex].humidityMax !== undefined
              ? Math.max(points[existingIndex].humidityMax, point.humidityMax)
              : point.humidityMax;
        }
      } else {
        points.push(point);
        points.sort((a, b) => a.timestamp - b.timestamp);
      }
    } else {
      this.data.set(sensorMac, [point]);
    }

    this.calculateBounds();
    this.render();
  }

  updateData(sensorData: AggregatedSensorData[]): void {
    // Clear existing data
    this.data.clear();

    // Group data by sensor
    sensorData.forEach((point) => {
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
      } else {
        this.data.set(point.sensorMac, [dataPoint]);
      }
    });

    // Sort each sensor's data by timestamp
    this.data.forEach((points) => {
      points.sort((a, b) => a.timestamp - b.timestamp);
    });

    this.calculateBounds();
    this.render();
  }

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

    // Time bounds
    this.timeBounds = {
      minX: minX === Infinity ? Date.now() / 1000 - 86400 : minX,
      maxX: maxX === -Infinity ? Date.now() / 1000 : maxX,
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

    // Humidity bounds (always 0-100% but can be narrowed if data allows)
    if (this.config.showHumidity) {
      this.humidityBounds = {
        minY: 0.0,
        maxY: 100.0,
      };
    }
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);

    // Draw grid and labels
    this.drawGrid();
    this.drawLabels();

    // Draw data lines
    const sortedSensors = Array.from(this.data.keys()).sort();
    const hasHoveredSensor = this.hoveredSensor !== null;

    // Draw non-hovered, non-active sensors first (background)
    sortedSensors.forEach((sensorMac, index) => {
      const points = this.data.get(sensorMac)!;
      const color =
        this.config.colors[index % this.config.colors.length] || "#4a9eff";
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
        this.config.colors[index % this.config.colors.length] || "#4a9eff";
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

  private drawGrid(): void {
    const { padding, width, height, gridLines } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);

    // Horizontal grid lines
    for (let i = 0; i <= gridLines.horizontal; i++) {
      const y = padding.top + (i * chartHeight) / gridLines.horizontal;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(width - padding.right, y);
      this.ctx.stroke();
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
        this.ctx.beginPath();
        this.ctx.moveTo(x, padding.top);
        this.ctx.lineTo(x, height - padding.bottom);
        this.ctx.stroke();
      }
    });

    this.ctx.setLineDash([]);
  }

  private drawLabels(): void {
    const { padding, width, height, gridLines } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

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
        this.ctx.fillText(label, x, height - padding.bottom + 5);
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
      const humidityGridHeight = chartHeight / this.config.gridLines.horizontal;
      const humidityPaddingTop =
        padding.top +
        humidityGridHeight * (this.config.gridLines.horizontal - 2);
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

  private drawTemperatureLine(
    points: ChartDataPoint[],
    color: string,
    opacity: number,
    isHovered: boolean,
  ): void {
    const tempPoints = points.filter((p) => p.temperature !== undefined);
    if (tempPoints.length === 0) return;

    const { padding, width, height } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const sensorMac = tempPoints[0]!.sensorMac;
    const isActive = this.activeSensors.has(sensorMac);

    // Increase opacity for active or hovered sensor
    const effectiveOpacity = isActive || isHovered ? 1.0 : opacity;

    // Adjust line widths for high-DPI displays and maintain visual hierarchy
    // We use slightly thinner lines on high-DPI displays since they're already sharper
    const baseWidth = this.devicePixelRatio > 1 ? 0.8 : 1;
    const lineWidth = isHovered ? 3 * baseWidth : isActive ? 2 * baseWidth : 1.5 * baseWidth;

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
      this.ctx.beginPath();

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
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
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

        this.ctx.lineTo(x, y);
      }

      // Close and fill the path
      this.ctx.closePath();
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = effectiveOpacity * 0.25; // Transparent fill for the area
      this.ctx.fill();

      // Reset alpha for the main line
      this.ctx.globalAlpha = effectiveOpacity;
    }

    // Draw main line
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = effectiveOpacity;
    this.ctx.lineWidth = isHovered || isActive ? 3 : 2;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.setLineDash([]);

    this.ctx.beginPath();
    tempPoints.forEach((point, index) => {
      const x = getX(point.timestamp);
      const y = getY(point.temperature!);

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered or active
    if (isHovered || isActive) {
      this.ctx.fillStyle = color;
      tempPoints.forEach((point) => {
        const x = getX(point.timestamp);
        const y = getY(point.temperature!);

        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.fill();
      });
    }

    this.ctx.globalAlpha = 1;
  }

  private drawHumidityLine(
    points: ChartDataPoint[],
    color: string,
    opacity: number,
    isHovered: boolean,
  ): void {
    const humidityPoints = points.filter((p) => p.humidity !== undefined);
    if (humidityPoints.length === 0) return;

    const { padding, width, height } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    // Humidity's y-axis is not as tall as the temperatures - to keep them less overlapped
    const humidityGridHeight = chartHeight / this.config.gridLines.horizontal;
    const humidityChartHeight = humidityGridHeight * 2;
    const humidityPaddingTop =
      padding.top + humidityGridHeight * (this.config.gridLines.horizontal - 2);

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
    const lineWidth = isHovered ? 2 * baseWidth : isActive ? 1.75 * baseWidth : 1.25 * baseWidth;

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
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
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

        this.ctx.lineTo(x, y);
      }

      // Close and fill the path
      this.ctx.closePath();
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = effectiveOpacity * 0.15; // More transparent fill for humidity area
      this.ctx.fill();
    }

    // Draw main line
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = effectiveOpacity * 0.6; // More transparent for secondary priority
    this.ctx.lineWidth = isHovered || isActive ? 2.5 : 1.75; // Thinner than temperature lines
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    // More pronounced dash pattern for better visibility
    this.ctx.setLineDash(isHovered || isActive ? [8, 4] : [6, 3]); // Larger dash pattern, especially when active

    this.ctx.beginPath();
    humidityPoints.forEach((point, index) => {
      const x = getX(point.timestamp);
      const y = getY(point.humidity!);

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered or active
    if (isHovered || isActive) {
      // Reset line dash for points
      this.ctx.setLineDash([]);
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = effectiveOpacity * 0.8; // Make points more visible than lines but still secondary
      humidityPoints.forEach((point) => {
        const x = getX(point.timestamp);
        const y = getY(point.humidity!);

        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI); // Slightly smaller points than temperature
        this.ctx.fill();
      });
    }

    this.ctx.globalAlpha = 1;
    this.ctx.setLineDash([]);
  }

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

  resize(): void {
    // First reset all transformations to identity matrix
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear the entire canvas at its actual pixel dimensions
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Reset device pixel ratio before reconfiguring
    this.devicePixelRatio = 1;

    // Reconfigure canvas with correct dimensions and scaling
    this.setupCanvas();

    // Redraw the chart with the new dimensions
    this.render();
  }

  clear(): void {
    this.data.clear();
    this.activeSensors.clear();

    // Clear the entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.render();
  }

  clearActiveSensors(): void {
    this.activeSensors.clear();
    this.render();
  }

  getActiveSensors(): string[] {
    return Array.from(this.activeSensors);
  }
}
