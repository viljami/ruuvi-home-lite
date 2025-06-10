// Import and re-export all types from shared package - following DRY principle
export * from "@ruuvi-home/shared/types";
export * from "@ruuvi-home/shared/events";

// Re-export specific types for convenience
export type {
  TimeRange,
  SensorReading,
  SensorReadingWithAge,
  AggregatedSensorData,
  SensorBucketUpdate,
  BaseMessage,
  ClientMessage,
  ServerMessage,
  WebSocketMessage,
  GetDataMessage,
  GetSensorNamesMessage,
  AdminAuthMessage,
  SetSensorNameMessage,
  HistoricalDataMessage,
  SensorDataMessage,
  LatestReadingsMessage,
  BucketUpdateMessage,
  AdminAuthResultMessage,
  SensorNamesMessage,
  SensorNameSetMessage,
  SensorNameDeletedMessage,
} from "@ruuvi-home/shared";
