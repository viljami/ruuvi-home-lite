export * from './sensor.js';

// Re-export specific types for convenience
export type {
  SensorReading,
  SensorReadingWithAge,
  AggregatedSensorData,
  RawSensorData,
  SensorDataPoint,
  SensorMetadata,
  TimeRange,
  SensorBucketUpdate,
  ChartBounds,
  ChartArea,
  ChartScale
} from './sensor.js';