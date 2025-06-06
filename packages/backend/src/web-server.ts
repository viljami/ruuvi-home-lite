import WebSocket from "ws";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as path from "path";
import { EventEmitter } from "events";
import { Database } from "./db.js";
import { SensorService } from "./sensor-service.js";
import type {
  SensorReading,
  TimeRange,
  AggregatedSensorData,
  HistoricalDataMessage,
  SensorDataMessage,
  LatestReadingsMessage,
  AdminAuthResultMessage,
  SensorNamesMessage,
  SensorNameSetMessage,
  SensorNameDeletedMessage,
  ErrorMessage,
} from "@ruuvi-home/shared";

const __dirname = path.resolve(path.dirname(""));
console.log(__dirname);

// Type alias for backward compatibility
export type ClientData = SensorReading;

interface ClientState {
  ws: WebSocket;
  timeRange: string;
  lastActivity: number;
}

export class WebServer extends EventEmitter {
  private database: Database;
  private sensorService: SensorService;
  private wss!: WebSocket.Server;
  private httpServer: any;
  private clientStates: Map<WebSocket, ClientState> = new Map();

  constructor(database: Database, sensorService: SensorService) {
    super();
    this.database = database;
    this.sensorService = sensorService;
    this.setupHttpServer();
    this.setupWebSocket();
  }

  private setupHttpServer(): void {
    const webCertPath = join(__dirname, "../certs/web-server.crt");
    const webKeyPath = join(__dirname, "../certs/web-server.key");

    // Try to use HTTPS with separate web certificates
    if (existsSync(webCertPath) && existsSync(webKeyPath)) {
      const options = {
        key: readFileSync(webKeyPath),
        cert: readFileSync(webCertPath),
      };

      this.httpServer = createHttpsServer(
        options,
        this.handleHttpRequest.bind(this),
      );
      this.httpServer.listen(3000, "0.0.0.0", () => {
        console.log("Server running on https://0.0.0.0:3000");
        console.log(
          `Access from local network: https://${process.env.SERVER_IP || "localhost"}:3000`,
        );
      });
    } else {
      // Fallback to HTTP if certificates don't exist
      console.log(
        "⚠️  Web server certificates not found, falling back to HTTP",
      );
      this.httpServer = createHttpServer(this.handleHttpRequest.bind(this));
      this.httpServer.listen(3000, "0.0.0.0", () => {
        console.log("Server running on http://0.0.0.0:3000");
        console.log(
          `Access from local network: http://${process.env.SERVER_IP || "localhost"}:3000`,
        );
      });
    }
  }

  private setupWebSocket(): void {
    this.wss = new WebSocket.Server({ server: this.httpServer });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("WebSocket client connected");

      // Initialize client state
      this.clientStates.set(ws, {
        ws: ws,
        timeRange: "day", // default
        lastActivity: Date.now(),
      });

      ws.on("message", (message: string) => {
        try {
          // Limit message size to prevent DoS
          if (message.length > 1024) {
            console.warn("WebSocket message too large, ignoring");
            return;
          }

          const request = JSON.parse(message.toString());

          // Validate request structure
          if (!request || typeof request !== "object") {
            console.warn("Invalid WebSocket request format");
            return;
          }

          // Only allow specific request types
          if (request.type === "getData") {
            // Validate timeRange parameter
            const allowedRanges = ["hour", "day", "week", "month", "year"];
            const timeRange = request.timeRange || "day";

            if (!allowedRanges.includes(timeRange)) {
              console.warn("Invalid time range requested:", timeRange);
              return;
            }

            // Update client state with current time range
            const clientState = this.clientStates.get(ws);
            if (clientState) {
              clientState.timeRange = timeRange;
              clientState.lastActivity = Date.now();
            }

            this.sendHistoricalData(ws, timeRange);
          } else if (request.type === "getLatestReadings") {
            this.sendLatestReadings(ws);
          } else if (request.type === "adminAuth") {
            this.handleAdminAuth(ws, request.password);
          } else if (request.type === "getSensorNames") {
            this.sendSensorNames(ws);
          } else if (request.type === "setSensorName") {
            this.handleSetSensorName(
              ws,
              request.sensorMac,
              request.customName,
              request.adminToken,
            );
          } else if (request.type === "deleteSensorName") {
            this.handleDeleteSensorName(
              ws,
              request.sensorMac,
              request.adminToken,
            );
          } else {
            console.warn("Unknown WebSocket request type:", request.type);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          // Don't send error details to client for security
        }
      });

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
        // Clean up client state
        this.clientStates.delete(ws);
      });
    });
  }

  private handleHttpRequest(req: any, res: any): void {
    // Add CORS and security headers for local network access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      // Security headers
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      // "X-XSS-Protection": "1; mode=block",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      // "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:",
      // "Referrer-Policy": "strict-origin-when-cross-origin"
    };

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(200, corsHeaders);
      res.end();
      return;
    }

    // Only allow GET requests for security
    if (req.method !== "GET") {
      res.writeHead(405, { ...corsHeaders, Allow: "GET, OPTIONS" });
      res.end("Method Not Allowed");
      return;
    }

    // Sanitize and validate file path to prevent directory traversal
    let filePath = req.url === "/" ? "/index.html" : req.url;

    // Remove query parameters and fragments for security
    filePath = filePath.split("?")[0].split("#")[0];

    // Normalize path to prevent directory traversal
    filePath = filePath.replace(/\.\./g, "").replace(/\/+/g, "/");

    // Only allow specific file extensions
    const allowedExtensions = [
      ".html",
      ".js",
      ".css",
      ".json",
      ".ico",
      ".png",
      ".jpg",
      ".svg",
    ];
    const fileExtension = filePath.substring(filePath.lastIndexOf("."));

    if (
      filePath !== "/index.html" &&
      !allowedExtensions.includes(fileExtension)
    ) {
      res.writeHead(403, corsHeaders);
      res.end("Forbidden file type");
      return;
    }

    const fullPath = join(__dirname, "../../public", filePath);
    console.log(fullPath);
    // Ensure the resolved path stays within public directory
    const publicDir = join(__dirname, "../../public");
    const resolvedPath = path.resolve(fullPath);
    const resolvedPublicDir = path.resolve(publicDir);
    console.log("fullPath", fullPath);
    console.log("resolvedPath", resolvedPath);
    console.log("resolvedPublicDir", resolvedPublicDir);

    if (!resolvedPath.startsWith(resolvedPublicDir)) {
      res.writeHead(403, corsHeaders);
      res.end("Access denied");
      return;
    }

    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath);
      const ext = filePath.split(".").pop();
      const contentType =
        ext === "html"
          ? "text/html"
          : ext === "js"
            ? "application/javascript"
            : ext === "css"
              ? "text/css"
              : "text/plain";

      res.writeHead(200, {
        "Content-Type": contentType,
        ...corsHeaders,
      });
      res.end(content);
    } else {
      res.writeHead(404, corsHeaders);
      res.end("Not found");
    }
  }

  broadcastToClients(data: ClientData): void {
    // Validate input data before broadcasting
    if (!data || typeof data !== "object") {
      console.error("Invalid client data provided");
      return;
    }

    // Sanitize and validate data fields
    const sanitizedMac = (data.sensorMac || "").replace(/[^a-f0-9:-]/gi, "");
    const temperature =
      typeof data.temperature === "number" && !isNaN(data.temperature)
        ? Math.round(data.temperature * 100) / 100
        : null;
    const humidity =
      typeof data.humidity === "number" && !isNaN(data.humidity)
        ? Math.round(data.humidity * 100) / 100
        : null;
    const timestamp =
      typeof data.timestamp === "number" && data.timestamp > 0
        ? data.timestamp
        : Date.now();

    // Only send minimal data to clients (temperature, humidity, timestamp, sensorMac)
    const clientData = {
      sensorMac: sanitizedMac,
      temperature: temperature || 0.0,
      humidity: humidity,
      timestamp: timestamp,
    };

    try {
      // ZERO POLLING: Smart broadcasting - only send real-time data
      // Client is responsible for aggregating and maintaining its own view
      this.smartBroadcastRealTimeData(clientData);
    } catch (error) {
      console.error("Error broadcasting to clients:", error);
    }
  }

  private async sendHistoricalData(
    ws: WebSocket,
    timeRange: string,
  ): Promise<void> {
    try {
      // Rate limiting: prevent rapid requests
      const now = Date.now();
      const lastRequest = (ws as any).lastHistoricalRequest || 0;
      if (now - lastRequest < 1000) {
        // 1 second minimum between requests
        console.warn("Rate limiting historical data request");
        return;
      }
      (ws as any).lastHistoricalRequest = now;

      const rows = await this.database.getAggregatedHistoricalData(timeRange);

      // Convert AggregatedDataRow to AggregatedSensorData
      const aggregatedData: AggregatedSensorData[] = rows.map((row) => ({
        ...row,
        count: row.dataPoints,
        isAggregated: true as const,
      }));

      // Limit response size
      const maxRows = 1000;
      const limitedRows = aggregatedData.slice(0, maxRows);

      // Define bucket sizes for the client
      const bucketConfigs = {
        hour: 300, // 5 minutes in seconds
        day: 3600, // 1 hour in seconds
        week: 21600, // 6 hours in seconds
        month: 86400, // 1 day in seconds
        year: 2592000, // 30 days in seconds
      };

      const response: HistoricalDataMessage = {
        type: "historicalData",
        data: limitedRows,
        truncated: aggregatedData.length > maxRows,
        timeRange: timeRange as TimeRange,
        bucketSize:
          bucketConfigs[timeRange as keyof typeof bucketConfigs] ||
          bucketConfigs.day,
        aggregated: true,
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error("Error getting historical data:", error);
      // Send generic error to client without details
      if (ws.readyState === WebSocket.OPEN) {
        const errorMessage: ErrorMessage = {
          type: "error",
          message: "Failed to retrieve data",
        };
        ws.send(JSON.stringify(errorMessage));
      }
    }
  }

  private async sendLatestReadings(ws: WebSocket): Promise<void> {
    try {
      // Rate limiting: prevent rapid requests
      const now = Date.now();
      const lastRequest = (ws as any).lastLatestRequest || 0;
      if (now - lastRequest < 500) {
        // 500ms minimum between requests
        console.warn("Rate limiting latest readings request");
        return;
      }
      (ws as any).lastLatestRequest = now;

      const readings = await this.database.getLatestSensorReadings();

      const response: LatestReadingsMessage = {
        type: "latestReadings",
        data: readings,
        timestamp: Math.floor(Date.now() / 1000),
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error("Error getting latest readings:", error);
      if (ws.readyState === WebSocket.OPEN) {
        const errorMessage: ErrorMessage = {
          type: "error",
          message: "Failed to retrieve latest readings",
        };
        ws.send(JSON.stringify(errorMessage));
      }
    }
  }

  private handleAdminAuth(ws: WebSocket, password: string): void {
    const result = this.sensorService.authenticateAdmin(password);

    if (result.success && result.token) {
      (ws as any).adminToken = result.token;
    }

    if (ws.readyState === WebSocket.OPEN) {
      const response: AdminAuthResultMessage = {
        type: "adminAuthResult",
        success: result.success,
        ...(result.token && { token: result.token }),
        ...(result.message && { message: result.message }),
      };
      ws.send(JSON.stringify(response));
    }
  }

  private async sendSensorNames(ws: WebSocket): Promise<void> {
    try {
      const sensorNames = await this.sensorService.getSensorNames();

      if (ws.readyState === WebSocket.OPEN) {
        const response: SensorNamesMessage = {
          type: "sensorNames",
          data: sensorNames,
        };
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error("Error getting sensor names:", error);
      if (ws.readyState === WebSocket.OPEN) {
        const errorMessage: ErrorMessage = {
          type: "error",
          message: "Failed to retrieve sensor names",
        };
        ws.send(JSON.stringify(errorMessage));
      }
    }
  }

  private async handleSetSensorName(
    ws: WebSocket,
    sensorMac: string,
    customName: string,
    adminToken: string,
  ): Promise<void> {
    const result = await this.sensorService.setSensorName(
      sensorMac,
      customName,
      adminToken,
    );

    if (ws.readyState === WebSocket.OPEN) {
      if (result.success) {
        const response: SensorNameSetMessage = {
          type: "sensorNameSet",
          success: true,
          sensorMac: result.sensorMac!,
          customName: result.customName!,
        };
        ws.send(JSON.stringify(response));

        // Send updated sensor names to all clients
        this.broadcastSensorNames();
      } else {
        const errorMessage: ErrorMessage = {
          type: "error",
          message: result.message!,
        };
        ws.send(JSON.stringify(errorMessage));
      }
    }
  }

  private async handleDeleteSensorName(
    ws: WebSocket,
    sensorMac: string,
    adminToken: string,
  ): Promise<void> {
    const result = await this.sensorService.deleteSensorName(
      sensorMac,
      adminToken,
    );

    if (ws.readyState === WebSocket.OPEN) {
      if (result.success) {
        const response: SensorNameDeletedMessage = {
          type: "sensorNameDeleted",
          success: true,
          sensorMac: result.sensorMac!,
        };
        ws.send(JSON.stringify(response));

        // Send updated sensor names to all clients
        this.broadcastSensorNames();
      } else {
        const errorMessage: ErrorMessage = {
          type: "error",
          message: result.message!,
        };
        ws.send(JSON.stringify(errorMessage));
      }
    }
  }

  private async broadcastSensorNames(): Promise<void> {
    try {
      const sensorNames = await this.sensorService.getSensorNames();
      const message: SensorNamesMessage = {
        type: "sensorNames",
        data: sensorNames,
      };

      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(message));
          } catch (error) {
            console.error("Error broadcasting sensor names:", error);
          }
        }
      });
    } catch (error) {
      console.error("Failed to broadcast sensor names:", error);
    }
  }

  private smartBroadcastRealTimeData(clientData: ClientData): void {
    const sensorDataWithAge = {
      ...clientData,
      secondsAgo: 0, // Real-time data is always "now"
    };

    const message: SensorDataMessage = {
      type: "sensorData",
      data: sensorDataWithAge,
    };
    const messageStr = JSON.stringify(message);

    this.clientStates.forEach((_clientState, client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Send real-time data - client will update its local state
          client.send(messageStr);
        } catch (error) {
          console.error("Error sending real-time data to client:", error);
        }
      }
    });
  }

  getConnectedClients(): number {
    return this.wss.clients.size;
  }

  close(): void {
    this.clientStates.clear();
    this.wss.close();
    this.httpServer.close();
  }
}
