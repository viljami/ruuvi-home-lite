import { Database, SensorData } from './db';
import { MQTTClient, SensorDataEvent } from './mqtt-client';
import { WebServer, ClientData } from './web-server';

class RuuviServer {
  private database: Database;
  private mqttClient: MQTTClient;
  private webServer: WebServer;

  constructor() {
    this.database = new Database();
    this.mqttClient = new MQTTClient();
    this.webServer = new WebServer(this.database);
    this.setupEventHandlers();
  }
  private setupEventHandlers(): void {
    // Handle sensor data from MQTT
    this.mqttClient.on('sensorData', (sensorData: SensorDataEvent) => {
      // Convert to database format
      const dbData: SensorData = {
        sensorMac: sensorData.sensorMac,
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        timestamp: sensorData.timestamp,
        pressure: sensorData.pressure,
        batteryVoltage: sensorData.batteryVoltage,
        txPower: sensorData.txPower,
        movementCounter: sensorData.movementCounter,
        measurementSequence: sensorData.measurementSequence,
        accelerationX: sensorData.accelerationX,
        accelerationY: sensorData.accelerationY,
        accelerationZ: sensorData.accelerationZ
      };

      // Save to database
      this.database.saveSensorData(dbData);

      // Broadcast to web clients (minimal data)
      const clientData: ClientData = {
        sensorMac: sensorData.sensorMac,
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        timestamp: sensorData.timestamp
      };
      this.webServer.broadcastToClients(clientData);
    });

    // Handle MQTT errors
    this.mqttClient.on('error', (error) => {
      console.error('MQTT error:', error);
    });

    // Handle MQTT disconnection
    this.mqttClient.on('disconnected', () => {
      console.log('MQTT disconnected, attempting to reconnect...');
    });
  }
}

new RuuviServer();