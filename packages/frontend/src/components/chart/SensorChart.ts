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
}

export interface ChartDataPoint {
  sensorMac: string;
  timestamp: number;
  temperature?: number;
  humidity?: number;
}

export class SensorChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ChartConfig;
  private data: Map<string, ChartDataPoint[]> = new Map();
  private timeRange: TimeRange = "day";
  private hoveredSensor: string | null = null;
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
    };

    this.setupCanvas();
  }

  private setupCanvas(): void {
    // Set canvas size based on container
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.config.width = this.canvas.width;
      this.config.height = this.canvas.height;
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

  updateValue(
    sensorMac: string,
    timestamp: number,
    temperature?: number,
    humidity?: number,
  ) {
    const points = this.data.get(sensorMac);
    const point: ChartDataPoint = { sensorMac, timestamp };

    if (temperature !== undefined) point.temperature = temperature;
    if (humidity !== undefined) point.humidity = humidity;

    if (points) {
      // Find existing point at same timestamp or add new one
      const bucketSize = TimeFormatter.getBucketSize(
        this.timeRange,
        this.config.gridLines.vertical,
      );
      const existingIndex = points.findIndex(
        (p) => Math.abs(p.timestamp - timestamp) < bucketSize - 10,
      );
      if (existingIndex >= 0 && points[existingIndex]) {
        if (temperature !== undefined) {
          points[existingIndex].temperature = temperature;
        }

        if (humidity !== undefined) {
          points[existingIndex].humidity = humidity;
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
      }

      if (point.avgHumidity !== null && this.config.showHumidity) {
        dataPoint.humidity = point.avgHumidity;
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
    sortedSensors.forEach((sensorMac, index) => {
      const points = this.data.get(sensorMac)!;
      const color =
        this.config.colors[index % this.config.colors.length] || "#4a9eff";
      const isHovered = this.hoveredSensor === sensorMac;
      const opacity = this.hoveredSensor && !isHovered ? 0.2 : 1;

      // Draw temperature line (solid)
      this.drawTemperatureLine(points, color, opacity, isHovered);

      // Draw humidity line (dotted) if enabled
      if (this.config.showHumidity) {
        this.drawHumidityLine(points, color, opacity, isHovered);
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

    // Vertical grid lines
    for (let i = 0; i <= gridLines.vertical; i++) {
      const x = padding.left + (i * chartWidth) / gridLines.vertical;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, height - padding.bottom);
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);
  }

  private drawLabels(): void {
    const { padding, width, height, gridLines } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    this.ctx.fillStyle = "#999";
    this.ctx.font = "11px monospace";

    // X-axis labels (time)
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    for (let i = 0; i <= gridLines.vertical; i++) {
      const x = padding.left + (i * chartWidth) / gridLines.vertical;
      const timestamp =
        this.timeBounds.minX +
        (i * (this.timeBounds.maxX - this.timeBounds.minX)) /
          gridLines.vertical;
      const label = TimeFormatter.formatTimeLabel(timestamp, this.timeRange);
      this.ctx.fillText(label, x, height - padding.bottom + 5);
    }

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
      this.ctx.fillStyle = "#666";

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

    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity;
    this.ctx.lineWidth = isHovered ? 3 : 2;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.setLineDash([]);

    // Draw line
    this.ctx.beginPath();
    tempPoints.forEach((point, index) => {
      const x =
        padding.left +
        ((point.timestamp - this.timeBounds.minX) /
          (this.timeBounds.maxX - this.timeBounds.minX)) *
          chartWidth;
      const y =
        padding.top +
        ((this.temperatureBounds.maxY - point.temperature!) /
          (this.temperatureBounds.maxY - this.temperatureBounds.minY)) *
          chartHeight;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered
    if (isHovered) {
      this.ctx.fillStyle = color;
      tempPoints.forEach((point) => {
        const x =
          padding.left +
          ((point.timestamp - this.timeBounds.minX) /
            (this.timeBounds.maxX - this.timeBounds.minX)) *
            chartWidth;
        const y =
          padding.top +
          ((this.temperatureBounds.maxY - point.temperature!) /
            (this.temperatureBounds.maxY - this.temperatureBounds.minY)) *
            chartHeight;

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
    const humPoints = points.filter((p) => p.humidity !== undefined);
    if (humPoints.length === 0) return;

    const { padding, width, height } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const humidityGridHeight = chartHeight / this.config.gridLines.horizontal;
    const humidityChartHeight = humidityGridHeight * 2;
    const humidityPaddingTop =
      padding.top + humidityGridHeight * (this.config.gridLines.horizontal - 2);

    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity * 0.7; // Make humidity lines slightly more transparent
    this.ctx.lineWidth = isHovered ? 2 : 1;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.setLineDash([5, 5]); // Dotted line for humidity

    // Draw line
    this.ctx.beginPath();
    humPoints.forEach((point, index) => {
      const x =
        padding.left +
        ((point.timestamp - this.timeBounds.minX) /
          (this.timeBounds.maxX - this.timeBounds.minX)) *
          chartWidth;
      const y =
        humidityPaddingTop +
        ((this.humidityBounds.maxY - point.humidity!) /
          (this.humidityBounds.maxY - this.humidityBounds.minY)) *
          humidityChartHeight;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw points if hovered
    if (isHovered) {
      this.ctx.fillStyle = color;
      this.ctx.setLineDash([]);
      humPoints.forEach((point) => {
        const x =
          padding.left +
          ((point.timestamp - this.timeBounds.minX) /
            (this.timeBounds.maxX - this.timeBounds.minX)) *
            chartWidth;
        const y =
          humidityPaddingTop +
          ((this.humidityBounds.maxY - point.humidity!) /
            (this.humidityBounds.maxY - this.humidityBounds.minY)) *
            humidityChartHeight;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
      });
    }

    this.ctx.globalAlpha = 1;
    this.ctx.setLineDash([]);
  }

  resize(): void {
    this.setupCanvas();
    this.render();
  }

  clear(): void {
    this.data.clear();
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);
  }
}
