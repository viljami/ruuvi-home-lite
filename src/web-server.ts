import * as WebSocket from 'ws';
import { createServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import { Database } from './db';

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
    const options = {
      key: readFileSync('/etc/mosquitto/certs/server.key'),
      cert: readFileSync('/etc/mosquitto/certs/server.crt')
    };
    
    this.httpServer = createServer(options, this.handleHttpRequest.bind(this));
    this.httpServer.listen(3000, () => {
      console.log('Server running on https://localhost:3000');
    });
  }

  private setupWebSocket(): void {
    this.wss = new WebSocket.Server({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      
      ws.on('message', (message: string) => {
        try {
          const request = JSON.parse(message.toString());
          if (request.type === 'getData') {
            this.sendHistoricalData(ws, request.timeRange || 'day');
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  private handleHttpRequest(req: any, res: any): void {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    const fullPath = join(__dirname, '../public', filePath);

    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath);
      const ext = filePath.split('.').pop();
      const contentType = ext === 'html' ? 'text/html' : 
                         ext === 'js' ? 'application/javascript' : 
                         ext === 'css' ? 'text/css' : 'text/plain';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  broadcastToClients(data: ClientData): void {
    // Only send minimal data to clients (temperature, humidity, timestamp, sensorMac)
    const clientData = {
      sensorMac: data.sensorMac,
      temperature: data.temperature,
      humidity: data.humidity,
      timestamp: data.timestamp
    };
    const message = JSON.stringify({ type: 'sensorData', data: clientData });
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async sendHistoricalData(ws: WebSocket, timeRange: string): Promise<void> {
    try {
      const rows = await this.database.getHistoricalData(timeRange);
      ws.send(JSON.stringify({ type: 'historicalData', data: rows }));
    } catch (error) {
      console.error('Error getting historical data:', error);
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