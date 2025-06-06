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
  type: "temperature" | "humidity";
}

export interface ChartDataPoint {
  sensorMac: string;
  timestamp: number;
  value: number;
}

export class SensorChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ChartConfig;
  private data: Map<string, ChartDataPoint[]> = new Map();
  private timeRange: TimeRange = "day";
  private hoveredSensor: string | null = null;
  private bounds = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
  };

  constructor(canvas: HTMLCanvasElement, config: Partial<ChartConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.config = {
      width: canvas.width,
      height: canvas.height,
      padding: {
        top: 20,
        right: 20,
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
      type: config.type || "temperature",
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

  updateValue(sensorMac: string, timestamp: number, value: number) {
    const points = this.data.get(sensorMac);
    const point = { sensorMac, timestamp, value };

    if (points) {
      let firstStep = (points[1]?.timestamp || 0) - (points[0]?.timestamp || 0);
      let lastStep =
        (points[points.length - 1]?.timestamp || 0) -
        (points[points.length - 2]?.timestamp || 0);

      if (firstStep > 0 && Math.abs(firstStep - lastStep) > 10) {
        points.pop();
      }

      points.push(point);
    } else {
      this.data.set(sensorMac, [point]);
    }

    this.render();
  }

  isOutDated(sensorMac: string): boolean {
    const points = this.data.get(sensorMac);

    if (points) {
      let firstStep = (points[1]?.timestamp || 0) - (points[0]?.timestamp || 0);
      let lastStep =
        (points[points.length - 1]?.timestamp || 0) -
        (points[points.length - 2]?.timestamp || 0);

      return firstStep <= 0 || firstStep - lastStep < 0;
    } else {
      return true;
    }
  }

  updateData(sensorData: AggregatedSensorData[]): void {
    // Clear existing data
    this.data.clear();

    // Group data by sensor
    sensorData.forEach((point) => {
      if (!this.data.has(point.sensorMac)) {
        this.data.set(point.sensorMac, []);
      }

      const value =
        this.config.type === "temperature"
          ? point.avgTemperature
          : point.avgHumidity;

      if (value !== null) {
        this.data.get(point.sensorMac)!.push({
          sensorMac: point.sensorMac,
          timestamp: point.timestamp,
          value,
        });
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
    let minY = Infinity;
    let maxY = -Infinity;

    this.data.forEach((points) => {
      points.forEach((point) => {
        minX = Math.min(minX, point.timestamp);
        maxX = Math.max(maxX, point.timestamp);
        minY = Math.min(minY, point.value);
        maxY = Math.max(maxY, point.value);
      });
    });

    // Add some padding to Y bounds
    const yPadding = (maxY - minY) * 0.1 || 1;
    this.bounds = {
      minX: minX === Infinity ? Date.now() / 1000 - 86400 : minX,
      maxX: maxX === -Infinity ? Date.now() / 1000 : maxX,
      minY: minY === Infinity ? 0 : minY - yPadding,
      maxY: maxY === -Infinity ? 100 : maxY + yPadding,
    };

    // Round Y bounds to nice numbers
    if (this.config.type === "temperature") {
      this.bounds.minY = Math.floor(this.bounds.minY / 5) * 5;
      this.bounds.maxY = Math.ceil(this.bounds.maxY / 5) * 5;
    } else {
      this.bounds.minY = Math.max(0, Math.floor(this.bounds.minY / 10) * 10);
      this.bounds.maxY = Math.min(100, Math.ceil(this.bounds.maxY / 10) * 10);
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

      this.drawLine(points, color, opacity, isHovered);
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
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";

    // X-axis labels (time)
    for (let i = 0; i <= gridLines.vertical; i++) {
      const x = padding.left + (i * chartWidth) / gridLines.vertical;
      const timestamp =
        this.bounds.minX +
        (i * (this.bounds.maxX - this.bounds.minX)) / gridLines.vertical;
      const label = TimeFormatter.formatTimeLabel(timestamp, this.timeRange);

      this.ctx.fillText(label, x, height - padding.bottom + 5);
    }

    // Y-axis labels
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";

    const unit = this.config.type === "temperature" ? "°C" : "%";
    for (let i = 0; i <= gridLines.horizontal; i++) {
      const y = padding.top + (i * chartHeight) / gridLines.horizontal;
      const value =
        this.bounds.maxY -
        (i * (this.bounds.maxY - this.bounds.minY)) / gridLines.horizontal;
      const label = `${value.toFixed(1)}${unit}`;

      this.ctx.fillText(label, padding.left - 8, y);
    }
  }

  private drawLine(
    points: ChartDataPoint[],
    color: string,
    opacity: number,
    isHovered: boolean,
  ): void {
    if (points.length === 0) return;

    const { padding, width, height } = this.config;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity;
    this.ctx.lineWidth = isHovered ? 3 : 2;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    // Draw line
    this.ctx.beginPath();
    points.forEach((point, index) => {
      const x =
        padding.left +
        ((point.timestamp - this.bounds.minX) /
          (this.bounds.maxX - this.bounds.minX)) *
          chartWidth;
      const y =
        padding.top +
        ((this.bounds.maxY - point.value) /
          (this.bounds.maxY - this.bounds.minY)) *
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
      points.forEach((point) => {
        const x =
          padding.left +
          ((point.timestamp - this.bounds.minX) /
            (this.bounds.maxX - this.bounds.minX)) *
            chartWidth;
        const y =
          padding.top +
          ((this.bounds.maxY - point.value) /
            (this.bounds.maxY - this.bounds.minY)) *
            chartHeight;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.fill();
      });
    }

    this.ctx.globalAlpha = 1;
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
