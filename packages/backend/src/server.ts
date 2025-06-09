import { Database, SensorData } from "./db.js";
import { MQTTClient, SensorDataEvent } from "./mqtt-client.js";
import { WebServer, ClientData } from "./web-server.js";
import { SensorService } from "./sensor-service.js";

class RuuviServer {
  private database!: Database;
  private mqttClient!: MQTTClient;
  private webServer!: WebServer;
  private sensorService!: SensorService;
  private isShuttingDown: boolean = false;

  constructor() {
    // Constructor now only sets up process handlers
    this.setupProcessHandlers();
  }

  async init(): Promise<void> {
    try {
      console.log("Starting Ruuvi Home Lite server...");

      // Validate environment
      this.validateEnvironment();

      // Initialize components with error handling
      console.log("🗃️ Initializing database...");
      this.database = new Database(process.env.DB_PATH || "data/ruuvi.db");
      await this.database.initialize();

      console.log("🔐 Initializing sensor service...");
      this.sensorService = new SensorService(this.database);

      console.log("📡 Initializing MQTT client...");
      this.mqttClient = new MQTTClient();

      console.log("🌐 Initializing web server...");
      this.webServer = new WebServer(this.database, this.sensorService);

      this.setupEventHandlers();

      console.log("Server initialization complete");
    } catch (error) {
      console.error("❌ Server initialization failed:", error);
      process.exit(1);
    }
  }

  private validateEnvironment(): void {
    // const requiredVars = ["MQTT_HOST", "MQTT_PORT", "MQTT_USER", "MQTT_PASS"];
    // const missing = requiredVars.filter((varName) => !process.env[varName]);

    // if (missing.length > 0) {
    //   throw new Error(
    //     `Missing required environment variables: ${missing.join(", ")}`,
    //   );
    // }

    if (process.env.MQTT_PASS === "GENERATED_DURING_SETUP") {
      throw new Error(
        "MQTT password not configured. Please run setup script first.",
      );
    }
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown on SIGTERM
    process.on("SIGTERM", () => {
      console.log("Received SIGTERM, shutting down gracefully...");
      this.shutdown();
    });

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
      console.log("Received SIGINT, shutting down gracefully...");
      this.shutdown();
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("💥 Uncaught Exception:", error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
      this.shutdown(1);
    });
  }

  private setupEventHandlers(): void {
    // Handle sensor data from MQTT
    this.mqttClient.on("sensorData", (sensorData: SensorDataEvent) => {
      try {
        // Security: Validate sensor data before processing
        if (!this.validateSensorData(sensorData)) {
          console.warn("Invalid sensor data received, ignoring");
          return;
        }

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
          accelerationZ: sensorData.accelerationZ,
        };

        // Save to database with error handling
        try {
          this.database.saveSensorData(dbData);
        } catch (dbError) {
          console.error("Failed to save sensor data to database:", dbError);
          return;
        }

        // ZERO POLLING: Event-driven broadcast to web clients
        const clientData: ClientData = {
          sensorMac: sensorData.sensorMac,
          temperature: sensorData.temperature,
          humidity: sensorData.humidity,
          timestamp: sensorData.timestamp,
        };

        try {
          // This triggers immediate real-time updates, latest readings, and bucket updates
          this.webServer.broadcastToClients(clientData);
          // Only log every 100th update to reduce noise
          if (Math.random() < 0.01) {
            console.log(
              `A update: ${sensorData.sensorMac} - ${sensorData.temperature}°C → ${this.webServer.getConnectedClients()} clients`,
            );
          }
        } catch (wsError) {
          console.error("Failed to broadcast to web clients:", wsError);
        }
      } catch (error) {
        console.error("Error processing sensor data:", error);
      }
    });

    // Handle MQTT errors
    this.mqttClient.on("error", (error) => {
      console.error("🔴 MQTT error:", error);

      // If it's an authentication error, don't retry immediately
      if (error.message?.includes("Not authorized")) {
        console.error(
          "MQTT authentication failed. Check credentials and ACL configuration.",
        );
        console.error(
          "Run setup script again to regenerate credentials if needed.",
        );
      }
    });

    // Handle MQTT disconnection
    this.mqttClient.on("disconnected", () => {
      console.log("🟡 MQTT disconnected, attempting to reconnect...");
    });

    // Handle MQTT connection
    this.mqttClient.on("connect", () => {
      console.log("🟢 MQTT connected successfully");
    });
  }

  private validateSensorData(data: SensorDataEvent): boolean {
    // Security: Validate all required fields
    if (!data || typeof data !== "object") {
      return false;
    }

    // Validate sensor MAC (required)
    if (!data.sensorMac || typeof data.sensorMac !== "string") {
      console.warn("Missing or invalid sensor MAC");
      return false;
    }

    // Sanitize MAC address format
    if (!/^[a-fA-F0-9:-]{12,17}$/.test(data.sensorMac)) {
      console.warn("Invalid MAC address format:", data.sensorMac);
      return false;
    }

    // Validate temperature (required)
    if (typeof data.temperature !== "number" || isNaN(data.temperature)) {
      console.warn("Missing or invalid temperature");
      return false;
    }

    // Validate temperature range (-40°C to +85°C for Ruuvi sensors)
    if (data.temperature < -40 || data.temperature > 85) {
      console.warn("Temperature out of valid range:", data.temperature);
      return false;
    }

    // Validate timestamp (required)
    if (typeof data.timestamp !== "number" || data.timestamp <= 0) {
      console.warn("Missing or invalid timestamp");
      return false;
    }

    // Validate timestamp is reasonable (not too far in past/future)
    const now = Math.floor(Date.now() / 1000);
    const oneHour = 60 * 60;
    if (Math.abs(data.timestamp - now) > oneHour) {
      console.warn(
        `Timestamp ${new Date(
          data.timestamp * 1000,
        ).toISOString()} too far from current time ${new Date().toISOString()}`,
      );
      return false;
    }

    // Validate optional fields if present
    if (
      data.humidity !== null &&
      (typeof data.humidity !== "number" ||
        data.humidity < 0 ||
        data.humidity > 100)
    ) {
      console.warn("Invalid humidity value:", data.humidity);
      return false;
    }

    if (
      data.pressure !== null &&
      (typeof data.pressure !== "number" ||
        data.pressure < 300 ||
        data.pressure > 1100)
    ) {
      console.warn("Invalid pressure value:", data.pressure);
      return false;
    }

    return true;
  }

  private shutdown(exitCode: number = 0): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log("🔄 Shutting down server...");

    // Close components gracefully
    try {
      if (this.mqttClient) {
        this.mqttClient.disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting MQTT client:", error);
    }

    try {
      if (this.webServer) {
        this.webServer.close();
      }
    } catch (error) {
      console.error("Error closing web server:", error);
    }

    try {
      if (this.database) {
        this.database.close();
      }
    } catch (error) {
      console.error("Error closing database:", error);
    }

    console.log("Server shutdown complete");
    process.exit(exitCode);
  }
}

// Initialize server
async function startServer(): Promise<void> {
  try {
    const server = new RuuviServer();
    await server.init();
  } catch (error) {
    console.error("💥 Failed to start Ruuvi server:", error);
    process.exit(1);
  }
}

startServer();
