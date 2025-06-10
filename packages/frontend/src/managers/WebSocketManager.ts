import type {
  ClientMessage,
  ServerMessage,
  WebSocketMessage,
} from "../types/index.js";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "reconnecting";

export interface WebSocketManagerConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  onMessage: (message: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private connectionAttempts = 0;
  private reconnectTimeout: number | null = null;
  private readonly config: WebSocketManagerConfig;

  constructor(config: WebSocketManagerConfig) {
    this.config = config;
  }

  connect(): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${location.host}`);
    this.connectionAttempts++;

    this.config.onStatusChange("connecting");

    this.ws.onopen = () => {
      this.connectionAttempts = 0;
      this.config.onStatusChange("connected");

      // Send initial requests
      this.send({ type: "getData", timeRange: "day" });
      this.send({ type: "getSensorNames" });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (this.isServerMessage(message)) {
          this.config.onMessage(message);
        } else {
          console.warn("Received unexpected message type:", message);
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    this.ws.onclose = (event) => {
      this.config.onStatusChange("disconnected");
      
      // Only reconnect for abnormal closures
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.config.onStatusChange("error");
    };
  }

  private scheduleReconnect(): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connectionAttempts < this.config.maxReconnectAttempts) {
      // Exponential backoff with a cap at 5 attempts (32x base delay)
      const delay = this.config.reconnectDelay * 
                   Math.pow(2, Math.min(this.connectionAttempts - 1, 5));
                   
      this.config.onStatusChange("reconnecting");
      this.reconnectTimeout = window.setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.config.onStatusChange("disconnected");
    }
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private isServerMessage(message: WebSocketMessage): message is ServerMessage {
    const validTypes = [
      "historicalData", "sensorData", "latestReadings", 
      "bucketUpdate", "adminAuthResult", "sensorNames", 
      "sensorNameSet", "sensorNameDeleted", "error"
    ];
    
    return validTypes.includes(message.type);
  }
}
