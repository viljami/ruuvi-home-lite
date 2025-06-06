export interface SensorReading {
  sensorMac: string;
  temperature: number;
  humidity: number | null;
  timestamp: number;
}

export interface ExtendedSensorReading extends SensorReading {
  pressure: number | null;
  batteryVoltage: number | null;
  txPower: number | null;
  movementCounter: number | null;
  measurementSequence: number | null;
  accelerationX: number | null;
  accelerationY: number | null;
  accelerationZ: number | null;
}

export interface SensorReadingWithAge extends SensorReading {
  secondsAgo: number;
}

export interface ExtendedSensorReadingWithAge extends ExtendedSensorReading {
  secondsAgo: number;
}

export interface AggregatedSensorData {
  sensorMac: string;
  timestamp: number;
  avgTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  avgHumidity: number | null;
  minHumidity: number | null;
  maxHumidity: number | null;
  count: number;
  isAggregated: true;
}

export interface RawSensorData extends SensorReading {
  isAggregated: false;
}

export type SensorDataPoint = AggregatedSensorData | RawSensorData;

export interface SensorMetadata {
  sensorMac: string;
  customName?: string;
  lastSeen?: number;
  isOnline: boolean;
}

export interface SensorName {
  sensorMac: string;
  customName: string;
  createdAt: number;
  updatedAt: number;
}

export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface SensorBucketUpdate {
  sensorMac: string;
  timestamp: number;
  bucketData: {
    timestamp: number;
    avgTemperature: number;
    minTemperature: number;
    maxTemperature: number;
    avgHumidity: number | null;
    minHumidity: number | null;
    maxHumidity: number | null;
    dataPoints: number;
  };
  timeRange: TimeRange;
}

export interface ChartBounds {
  minTemp: number;
  maxTemp: number;
  minHum: number;
  maxHum: number;
}

export interface ChartArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartScale {
  min: number;
  max: number;
}