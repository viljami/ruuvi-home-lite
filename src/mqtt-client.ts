import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { RuuviDecoder } from './ruuvi-decoder';

export interface SensorDataEvent {
  sensorMac: string;
  temperature: number;
  humidity: number | null;
  timestamp: number;
  pressure: number | null;
  batteryVoltage: number | null;
  txPower: number | null;
  movementCounter: number | null;
  measurementSequence: number | null;
  accelerationX: number | null;
  accelerationY: number | null;
  accelerationZ: number | null;
}

export class MQTTClient extends EventEmitter {
  private mqttClient!: mqtt.MqttClient;

  constructor() {
    super();
    this.setupMQTT();
  }

  private setupMQTT(): void {
    const options: mqtt.IClientOptions = {
      host: process.env.MQTT_HOST || 'localhost',
      port: parseInt(process.env.MQTT_PORT || '8883'),
      protocol: 'mqtts',
      username: process.env.MQTT_USER || 'ruuvi',
      password: process.env.MQTT_PASS || 'ruuvi123',
      rejectUnauthorized: false // For self-signed certs
    };

    this.mqttClient = mqtt.connect(options);
    
    this.mqttClient.on('connect', () => {
      console.log('MQTT connected');
      this.mqttClient.subscribe('ruuvi/+/+', { qos: 1 });
      this.mqttClient.subscribe('gateway/+/+', { qos: 1 });
      this.mqttClient.subscribe('ruuvi/+', { qos: 1 }); // Legacy single-level support
    });

    this.mqttClient.on('message', (topic: string, message: Buffer) => {
      try {
        console.log(`MQTT topic: ${topic}, message length: ${message.length}`);
        const gatewayData = JSON.parse(message.toString());
        
        // Extract Ruuvi data from BLE advertisement
        if (!gatewayData.data) {
          console.log(`No data field in gateway payload on topic ${topic}`);
          return;
        }
        
        const ruuviHex = this.extractRuuviFromBLE(gatewayData.data);
        if (!ruuviHex) {
          console.log(`No Ruuvi data found in BLE advertisement on topic ${topic}`);
          return;
        }
        
        const decoded = RuuviDecoder.decode(ruuviHex);
        
        // Extract sensor MAC from topic or use decoded MAC
        const topicParts = topic.split('/');
        let sensorMac = decoded?.mac || 'unknown';
        
        // Handle different topic patterns:
        // ruuvi/gateway_id/sensor_mac
        // gateway/gateway_id/sensor_mac  
        // ruuvi/sensor_mac (legacy)
        if (topicParts.length >= 3 && (topicParts[0] === 'ruuvi' || topicParts[0] === 'gateway')) {
          sensorMac = topicParts[2]; // Use MAC from topic
        } else if (topicParts.length === 2 && topicParts[0] === 'ruuvi') {
          sensorMac = topicParts[1]; // Legacy format
        }
        
        if (decoded && decoded.temperature !== null) {
          const sensorData: SensorDataEvent = {
            sensorMac: sensorMac,
            temperature: decoded.temperature,
            humidity: decoded.humidity || null,
            timestamp: Date.now(),
            pressure: decoded.pressure,
            batteryVoltage: decoded.batteryVoltage,
            txPower: decoded.txPower,
            movementCounter: decoded.movementCounter,
            measurementSequence: decoded.measurementSequence,
            accelerationX: decoded.accelerationX,
            accelerationY: decoded.accelerationY,
            accelerationZ: decoded.accelerationZ
          };
          
          console.log(`Decoded sensor data: ${sensorMac} - ${decoded.temperature}°C${decoded.humidity !== null ? `, ${decoded.humidity}%` : ' (no humidity)'}`);
          this.emit('sensorData', sensorData);
        } else {
          console.log(`Invalid or incomplete Ruuvi data on topic ${topic} (no temperature data)`);
        }
      } catch (error) {
        console.error('MQTT message decode error:', error);
      }
    });

    this.mqttClient.on('error', (error) => {
      console.error('MQTT connection error:', error);
      this.emit('error', error);
    });

    this.mqttClient.on('close', () => {
      console.log('MQTT connection closed');
      this.emit('disconnected');
    });
  }

  private extractRuuviFromBLE(bleData: string): string | null {
    try {
      // Look for Ruuvi manufacturer data in BLE advertisement
      // Format: ...FF9904[DATA_FORMAT][RUUVI_DATA]...
      // 9904 is manufacturer ID 0x0499 in little endian
      const ruuviMarker = '9904';
      const markerIndex = bleData.indexOf(ruuviMarker);
      
      if (markerIndex === -1) {
        return null;
      }
      
      // Extract Ruuvi payload starting from data format byte
      const ruuviStart = markerIndex + ruuviMarker.length;
      const ruuviPayload = bleData.slice(ruuviStart, ruuviStart + 48); // 24 bytes = 48 hex chars
      
      if (ruuviPayload.length !== 48) {
        return null;
      }
      
      return ruuviPayload;
    } catch (error) {
      console.error('Error extracting Ruuvi data from BLE:', error);
      return null;
    }
  }

  disconnect(): void {
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }
}