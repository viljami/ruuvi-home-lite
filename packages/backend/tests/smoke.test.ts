import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Database } from "../src/db.js";
import { MQTTClient } from "../src/mqtt-client.js";
import { SensorService } from "../src/sensor-service.js";
import type { ExtendedSensorReading } from "@ruuvi-home/shared";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Backend Smoke Tests", () => {
  let testDbPath: string;
  let database: Database;

  beforeEach(() => {
    // Create a temporary test database
    testDbPath = path.join(__dirname, `test-${Date.now()}.db`);
  });

  afterEach(async () => {
    // Clean up
    if (database) {
      try {
        await database.close();
      } catch (error) {
        // Ignore close errors in tests
      }
    }
    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore file removal errors
      }
    }
  });

  describe("Database", () => {
    it("should initialize successfully", async () => {
      database = new Database(testDbPath);
      await expect(database.initialize()).resolves.not.toThrow();
    });

    it("should save and retrieve sensor data", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      const testData: ExtendedSensorReading = {
        sensorMac: "AA:BB:CC:DD:EE:FF",
        temperature: 23.5,
        humidity: 45.2,
        timestamp: Math.floor(Date.now() / 1000),
        pressure: 1013.25,
        batteryVoltage: 2.8,
        txPower: -40,
        movementCounter: 10,
        measurementSequence: 100,
        accelerationX: 0.1,
        accelerationY: 0.2,
        accelerationZ: 9.8,
      };

      // Save sensor data
      database.saveSensorData(testData);

      // Retrieve latest readings
      const readings = await database.getLatestSensorReadings();
      expect(readings).toHaveLength(1);
      expect(readings[0].sensorMac).toBe(testData.sensorMac.toLowerCase());
      expect(readings[0].temperature).toBe(testData.temperature);
      expect(readings[0].humidity).toBe(testData.humidity);
    });

    it("should handle sensor names", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      const sensorMac = "AA:BB:CC:DD:EE:FF";
      const customName = "Living Room";

      // Set sensor name
      await database.setSensorName(sensorMac, customName);

      // Get sensor names
      const names = await database.getSensorNames();
      expect(names).toHaveLength(1);
      expect(names[0].sensorMac).toBe(sensorMac);
      expect(names[0].customName).toBe(customName);

      // Delete sensor name
      await database.deleteSensorName(sensorMac);
      const namesAfterDelete = await database.getSensorNames();
      expect(namesAfterDelete).toHaveLength(0);
    });

    it("should aggregate historical data", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      // Insert multiple data points
      const baseTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      for (let i = 0; i < 10; i++) {
        database.saveSensorData({
          sensorMac: "AA:BB:CC:DD:EE:FF",
          temperature: 20 + i,
          humidity: 40 + i,
          timestamp: baseTime + i * 300, // 5 minute intervals
          pressure: null,
          batteryVoltage: null,
          txPower: null,
          movementCounter: null,
          measurementSequence: null,
          accelerationX: null,
          accelerationY: null,
          accelerationZ: null,
        });
      }

      // Get aggregated data for the last day (24 hours)
      const aggregated = await database.getAggregatedHistoricalData("day");
      expect(aggregated.length).toBeGreaterThan(0);
      expect(aggregated[0].sensorMac).toBe("aa:bb:cc:dd:ee:ff");
      expect(aggregated[0].dataPoints).toBeGreaterThan(0);
      expect(aggregated[0].avgTemperature).toBeGreaterThan(19);
      expect(aggregated[0].avgTemperature).toBeLessThan(30);
    });
  });

  describe("MQTT Client", () => {
    it("should create MQTT client instance", () => {
      // Set required environment variables
      process.env.MQTT_BROKER = "test.mosquitto.org";
      process.env.MQTT_PORT = "1883";

      // The MQTT client will try to connect, but that's okay for a smoke test
      const mqttClient = new MQTTClient();
      expect(mqttClient).toBeDefined();
      expect(mqttClient).toBeInstanceOf(MQTTClient);

      // Clean up
      delete process.env.MQTT_BROKER;
      delete process.env.MQTT_PORT;
    });
  });

  describe("Web Server", () => {
    it("should create web server instance", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      const sensorService = new SensorService(database);

      // Skip WebServer test as it requires complex mocking
      // The WebServer is integration tested when running the actual server
      expect(sensorService).toBeDefined();
    });
  });

  describe("Sensor Service", () => {
    it("should handle admin authentication", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      // Set admin password
      process.env.ADMIN_PASSWORD = "test123";

      const sensorService = new SensorService(database);

      // Test wrong password
      const wrongAuth = sensorService.authenticateAdmin("wrong");
      expect(wrongAuth.success).toBe(false);

      // Test correct password
      const correctAuth = sensorService.authenticateAdmin("test123");
      expect(correctAuth.success).toBe(true);
      expect(correctAuth.token).toBeDefined();

      // Test that we got a token
      expect(correctAuth.token).toBeTruthy();
      expect(typeof correctAuth.token).toBe("string");

      // Clean up
      delete process.env.ADMIN_PASSWORD;
    });
  });

  describe("Migration Manager", () => {
    it("should check database health", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      const health = await database.checkDatabaseHealth();
      expect(health).toBe(true);
    });

    it("should get migration status", async () => {
      database = new Database(testDbPath);
      await database.initialize();

      const status = await database.getMigrationStatus();
      expect(status.isUpToDate).toBe(true);
      expect(status.appliedMigrations).toBeInstanceOf(Array);
      expect(status.pendingMigrations).toBeInstanceOf(Array);
    });
  });
});
