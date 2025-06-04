import * as WebSocket from "ws";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { EventEmitter } from "events";
import { Database } from "./db";

export interface ClientData {
  sensorMac: string;
  temperature: number;
  humidity: number | null;
  timestamp: number;
}

export class WebServer extends EventEmitter {
  private database: Database;
  private wss!: WebSocket.Server;
  private httpServer: any;

  constructor(database: Database) {
    super();
    this.database = database;
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

      this.httpServer = createHttpsServer(options, this.handleHttpRequest.bind(this));
      this.httpServer.listen(3000, "0.0.0.0", () => {
        console.log("Server running on https://0.0.0.0:3000");
        console.log(
          `Access from local network: https://${process.env.SERVER_IP || 'localhost'}:3000`,
        );
      });
    } else {
      // Fallback to HTTP if certificates don't exist
      console.log("⚠️  Web server certificates not found, falling back to HTTP");
      this.httpServer = createHttpServer(this.handleHttpRequest.bind(this));
      this.httpServer.listen(3000, "0.0.0.0", () => {
        console.log("Server running on http://0.0.0.0:3000");
        console.log(
          `Access from local network: http://${process.env.SERVER_IP || 'localhost'}:3000`,
        );
      });
    }
  }

  private setupWebSocket(): void {
    this.wss = new WebSocket.Server({ server: this.httpServer });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("WebSocket client connected");

      ws.on("message", (message: string) => {
        try {
          const request = JSON.parse(message.toString());
          if (request.type === "getData") {
            this.sendHistoricalData(ws, request.timeRange || "day");
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
      });
    });
  }

  private handleHttpRequest(req: any, res: any): void {
    // Add CORS headers for local network access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(200, corsHeaders);
      res.end();
      return;
    }

    let filePath = req.url === "/" ? "/index.html" : req.url;
    const fullPath = join(__dirname, "../public", filePath);

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
        ...corsHeaders
      });
      res.end(content);
    } else {
      res.writeHead(404, corsHeaders);
      res.end("Not found");
    }
  }

  broadcastToClients(data: ClientData): void {
    // Only send minimal data to clients (temperature, humidity, timestamp, sensorMac)
    const clientData = {
      sensorMac: data.sensorMac,
      temperature: data.temperature,
      humidity: data.humidity,
      timestamp: data.timestamp,
    };
    const message = JSON.stringify({ type: "sensorData", data: clientData });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async sendHistoricalData(
    ws: WebSocket,
    timeRange: string,
  ): Promise<void> {
    try {
      const rows = await this.database.getHistoricalData(timeRange);
      ws.send(JSON.stringify({ type: "historicalData", data: rows }));
    } catch (error) {
      console.error("Error getting historical data:", error);
    }
  }

  getConnectedClients(): number {
    return this.wss.clients.size;
  }

  close(): void {
    this.wss.close();
    this.httpServer.close();
  }


}
