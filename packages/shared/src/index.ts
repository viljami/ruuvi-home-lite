// Export all types
export * from "./types/sensor.js";

// Export all events
export * from "./events/websocket.js";

// Re-export for convenience
export type {
  SensorReading,
  SensorReadingWithAge,
  ExtendedSensorReading,
  ExtendedSensorReadingWithAge,
  AggregatedSensorData,
  RawSensorData,
  SensorDataPoint,
  SensorMetadata,
  SensorName,
  TimeRange,
  SensorBucketUpdate,
  ChartBounds,
  ChartArea,
  ChartScale,
} from "./types/sensor.js";

export type {
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
} from "./events/websocket.js";

export { isClientMessage, isServerMessage } from "./events/websocket.js";
