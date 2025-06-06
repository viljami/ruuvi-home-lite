export * from './websocket.js';

// Re-export specific types for convenience
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
  SensorNameDeletedMessage
} from './websocket.js';

export { isClientMessage, isServerMessage } from './websocket.js';