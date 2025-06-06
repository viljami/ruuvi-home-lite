import * as mqtt from "mqtt";
import { EventEmitter } from "events";
import { RuuviDecoder } from "./ruuvi-decoder.js";
import type { ExtendedSensorReading } from "@ruuvi-home/shared";

// Type alias for backward compatibility
export type SensorDataEvent = ExtendedSensorReading;

export class MQTTClient extends EventEmitter {
  private mqttClient!: mqtt.MqttClient;

  constructor() {
    super();
    this.setupMQTT();
  }

  private setupMQTT(): void {
    const port = parseInt(process.env.MQTT_PORT || "8883");
    const isSecure = port === 8883 || process.env.MQTT_TLS === "true";
    const username = process.env.MQTT_USER || "ruuvi";
    const password = process.env.MQTT_PASS || "";

    console.log(
      `🔗 Connecting to MQTT broker: ${isSecure ? "secure" : "insecure"} mode`,
    );

    const options: mqtt.IClientOptions = {
      host: process.env.MQTT_HOST || "localhost",
      port: port,
      protocol: isSecure ? "mqtts" : "mqtt",
      connectTimeout: 30 * 1000,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 5000,
      clientId: `ruuvi-home-${Math.random().toString(16).substr(2, 8)}`,
      username,
      password,
    };

    // Add TLS options for secure connections
    if (isSecure) {
      options.rejectUnauthorized = false; // For self-signed certs
    }

    this.mqttClient = mqtt.connect(options);

    this.mqttClient.on("connect", () => {
      console.log("MQTT connected");
      this.mqttClient.subscribe("ruuvi/+/+", { qos: 1 });
      this.mqttClient.subscribe("gateway/+/+", { qos: 1 });
      this.mqttClient.subscribe("ruuvi/+", { qos: 1 }); // Legacy single-level support
      this.emit("connect");
    });

    this.mqttClient.on("message", (topic: string, message: Buffer) => {
      try {
        // Security: Limit message size to prevent DoS attacks
        if (message.length > 8192) {
          console.warn(`Message too large (${message.length} bytes), ignoring`);
          return;
        }

        // Security: Validate topic format
        if (!this.isValidTopic(topic)) {
          console.warn(`Invalid topic format: ${topic}: {message}`);
          return;
        }

        console.log(`MQTT topic: ${topic}, message length: ${message.length}`);

        // Security: Parse JSON safely with size limit
        const messageStr = message.toString("utf8");
        // Gateway data example: {
        //  "gw_mac":"A1:B2:C3:D4:E5:F6",
        //  "rssi":-73,
        //  "aoa":[],
        //  "gwts":1749117770,
        //  "ts":1749117770,
        //  "data":"0201061BFF990405124148FBBE780064FFC003DCA93621128FEF2E0A68DC30",
        //  "coords":""
        // }
        const gatewayData = JSON.parse(messageStr);
        console.log(messageStr);
        // Security: Validate gateway data structure
        if (!gatewayData || typeof gatewayData !== "object") {
          console.warn("Invalid gateway data format");
          return;
        }

        // Extract Ruuvi data from BLE advertisement
        if (!gatewayData.data || typeof gatewayData.data !== "string") {
          console.log(
            `No valid data field in gateway payload on topic ${topic}`,
          );
          return;
        }

        // Security: Validate BLE data format and size
        if (gatewayData.data.length > 200) {
          console.warn("BLE data too long, possible attack");
          return;
        }

        const ruuviHex = this.extractRuuviFromBLE(gatewayData.data);
        if (!ruuviHex) {
          console.log(
            `No Ruuvi data found in BLE advertisement on topic ${topic}`,
          );
          return;
        }

        const decoded = RuuviDecoder.decode(ruuviHex);

        // Extract sensor MAC from topic or use decoded MAC
        const topicParts = topic.split("/");
        let sensorMac = (decoded?.mac || "unknown").toLowerCase();

        // Handle different topic patterns:
        // ruuvi/gateway_id/sensor_mac
        // gateway/gateway_id/sensor_mac
        // ruuvi/sensor_mac (legacy)
        if (
          topicParts.length >= 3 &&
          (topicParts[0] === "ruuvi" || topicParts[0] === "gateway") &&
          topicParts[2]
        ) {
          sensorMac = topicParts[2].toLowerCase(); // Use MAC from topic, normalize to lowercase
        } else if (
          topicParts.length === 2 &&
          topicParts[0] === "ruuvi" &&
          topicParts[1]
        ) {
          sensorMac = topicParts[1].toLowerCase(); // Legacy format, normalize to lowercase
        }

        if (decoded && decoded.temperature !== null) {
          // Use Ruuvi timestamp in seconds, fallback to current time in seconds
          const timestamp = gatewayData.ts || Math.floor(Date.now() / 1000);

          const sensorData: SensorDataEvent = {
            sensorMac: sensorMac,
            temperature: decoded.temperature,
            humidity: decoded.humidity || null,
            timestamp: timestamp,
            pressure: decoded.pressure,
            batteryVoltage: decoded.batteryVoltage,
            txPower: decoded.txPower,
            movementCounter: decoded.movementCounter,
            measurementSequence: decoded.measurementSequence,
            accelerationX: decoded.accelerationX,
            accelerationY: decoded.accelerationY,
            accelerationZ: decoded.accelerationZ,
          };

          console.log(
            `Decoded sensor data: ${sensorMac} - ${decoded.temperature}°C${decoded.humidity !== null ? `, ${decoded.humidity}%` : " (no humidity)"}`,
          );
          this.emit("sensorData", sensorData);
        } else {
          console.log(
            `Invalid or incomplete Ruuvi data on topic ${topic} (no temperature data)`,
          );
        }
      } catch (error) {
        console.error("MQTT message decode error:", error);
      }
    });

    this.mqttClient.on("error", (error) => {
      console.error("MQTT connection error:", error);
      this.emit("error", error);
    });

    this.mqttClient.on("close", () => {
      console.log("MQTT connection closed");
      this.emit("disconnected");
    });
  }

  private extractRuuviFromBLE(bleData: string): string | null {
    try {
      // Security: Validate input
      if (!bleData || typeof bleData !== "string") {
        return null;
      }

      // Security: Only allow hex characters
      if (!/^[0-9A-Fa-f]*$/.test(bleData)) {
        console.warn("BLE data contains non-hex characters");
        return null;
      }

      // Security: Limit BLE data length
      if (bleData.length > 200) {
        console.warn("BLE data too long");
        return null;
      }

      // Look for Ruuvi manufacturer data in BLE advertisement
      // Format: ...FF9904[DATA_FORMAT][RUUVI_DATA]...
      // 9904 is manufacturer ID 0x0499 in little endian
      const ruuviMarker = "9904";
      const markerIndex = bleData
        .toUpperCase()
        .indexOf(ruuviMarker.toUpperCase());

      if (markerIndex === -1) {
        return null;
      }

      // Extract Ruuvi payload starting from data format byte
      const ruuviStart = markerIndex + ruuviMarker.length;
      const ruuviPayload = bleData.slice(ruuviStart, ruuviStart + 48); // 24 bytes = 48 hex chars

      if (ruuviPayload.length !== 48) {
        return null;
      }

      return ruuviPayload.toUpperCase();
    } catch (error) {
      console.error("Error extracting Ruuvi data from BLE:", error);
      return null;
    }
  }

  private isValidTopic(topic: string): boolean {
    // Security: Validate topic format to prevent injection
    if (!topic || typeof topic !== "string") {
      return false;
    }

    // Limit topic length
    if (topic.length > 256) {
      return false;
    }

    // Check for valid topic patterns
    const validPatterns = [
      /^ruuvi/, // ruuvi/gateway_id/sensor_mac
    ];

    return validPatterns.some((pattern) => pattern.test(topic));
  }

  disconnect(): void {
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }
}
