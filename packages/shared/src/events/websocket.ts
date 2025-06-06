import {
  SensorName,
  SensorReading,
  SensorReadingWithAge,
  AggregatedSensorData,
  TimeRange,
} from "../types/sensor.js";

// Base message interface
export interface BaseMessage {
  type: string;
}

// Client to Server Messages
export interface GetDataMessage extends BaseMessage {
  type: "getData";
  timeRange: TimeRange;
}

export interface GetSensorNamesMessage extends BaseMessage {
  type: "getSensorNames";
}

export interface AdminAuthMessage extends BaseMessage {
  type: "adminAuth";
  password: string;
}

export interface SetSensorNameMessage extends BaseMessage {
  type: "setSensorName";
  sensorMac: string;
  customName: string;
  adminToken: string;
}

export type ClientMessage =
  | GetDataMessage
  | GetSensorNamesMessage
  | AdminAuthMessage
  | SetSensorNameMessage;

// Server to Client Messages
export interface HistoricalDataMessage extends BaseMessage {
  type: "historicalData";
  data: AggregatedSensorData[];
  bucketSize: number;
  aggregated: boolean;
  timeRange: TimeRange;
  truncated?: boolean;
}

export interface SensorDataMessage extends BaseMessage {
  type: "sensorData";
  data: SensorReading;
}

export interface LatestReadingsMessage extends BaseMessage {
  type: "latestReadings";
  data: SensorReadingWithAge[];
  timestamp: number;
}

export interface BucketUpdateMessage extends BaseMessage {
  type: "bucketUpdate";
  data: {
    sensorMac: string;
    timeRange: TimeRange;
    bucketData: any;
    bucketSize: number;
    timestamp: number;
  };
}

export interface AdminAuthResultMessage extends BaseMessage {
  type: "adminAuthResult";
  success: boolean;
  token?: string;
  message?: string;
}

export interface SensorNamesMessage extends BaseMessage {
  type: "sensorNames";
  data: SensorName[]; // Array of SensorName objects
}

export interface SensorNameSetMessage extends BaseMessage {
  type: "sensorNameSet";
  success: boolean;
  sensorMac: string;
  customName: string;
}

export interface SensorNameDeletedMessage extends BaseMessage {
  type: "sensorNameDeleted";
  success: boolean;
  sensorMac: string;
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  message: string;
}

export type ServerMessage =
  | HistoricalDataMessage
  | SensorDataMessage
  | LatestReadingsMessage
  | BucketUpdateMessage
  | AdminAuthResultMessage
  | SensorNamesMessage
  | SensorNameSetMessage
  | SensorNameDeletedMessage
  | ErrorMessage;

export type WebSocketMessage = ClientMessage | ServerMessage;

// Type guards
export function isClientMessage(
  message: WebSocketMessage,
): message is ClientMessage {
  return ["getData", "getSensorNames", "adminAuth", "setSensorName"].includes(
    message.type,
  );
}

export function isServerMessage(
  message: WebSocketMessage,
): message is ServerMessage {
  return [
    "historicalData",
    "sensorData",
    "latestReadings",
    "bucketUpdate",
    "adminAuthResult",
    "sensorNames",
    "sensorNameSet",
    "sensorNameDeleted",
    "error",
  ].includes(message.type);
}
