import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import * as path from "path";
import { MigrationManager, MigrationStatus } from "./migration-manager";
import type {
  ExtendedSensorReading,
  ExtendedSensorReadingWithAge,
  SensorReading,
  AggregatedSensorData,
  SensorName,
} from "@ruuvi-home/shared";

// Type aliases for backward compatibility
export type SensorData = ExtendedSensorReading;
export type HistoricalDataRow = SensorReading;
export type LatestSensorReading = ExtendedSensorReadingWithAge;

// Re-export SensorName for use in other modules
export type { SensorName };

// Extended type to match database column names
export interface AggregatedDataRow
  extends Omit<AggregatedSensorData, "count" | "isAggregated"> {
  dataPoints: number; // count of data points in bucket
}

export class Database {
  private db!: sqlite3.Database;
  private migrationManager!: MigrationManager;
  private insertStatement!: sqlite3.Statement;
  private latestReadingsStatement!: sqlite3.Statement;
  private getSensorNamesStatement!: sqlite3.Statement;
  private setSensorNameStatement!: sqlite3.Statement;
  private deleteSensorNameStatement!: sqlite3.Statement;

  constructor(dbPath: string = "ruuvi.db") {
    const validatedPath = this.validateAndSecurePath(dbPath);
    this.initializeDatabase(validatedPath);
  }

  async initialize(): Promise<void> {
    await this.runMigrationsIfNeeded();
    this.prepareMigrationStatements();
  }

  private validateAndSecurePath(dbPath: string): string {
    // Prevent directory traversal attacks
    const normalizedPath = path.normalize(dbPath);
    const resolvedPath = path.resolve(normalizedPath);
    const basePath = path.resolve(process.cwd());

    // Ensure database file stays within application directory
    if (!resolvedPath.startsWith(basePath)) {
      throw new Error("Database path must be within application directory");
    }

    // Only allow .db extension
    if (!resolvedPath.endsWith(".db")) {
      throw new Error("Database file must have .db extension");
    }

    // Ensure directory exists and is secure
    const dbDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true, mode: 0o750 });
    }

    return resolvedPath;
  }

  private initializeDatabase(dbPath: string): void {
    try {
      this.db = new sqlite3.Database(dbPath);

      // Set secure file permissions (owner read/write only)
      if (fs.existsSync(dbPath)) {
        fs.chmodSync(dbPath, 0o600);
      }

      // Performance optimizations
      this.configureDatabaseSettings();

      this.migrationManager = new MigrationManager(this.db);
      console.log(`Database connection established: ${dbPath}`);
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }

  private configureDatabaseSettings(): void {
    // Enable WAL mode for better concurrency
    this.db.exec("PRAGMA journal_mode = WAL;");

    // Optimize for performance
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA cache_size = 10000;");
    this.db.exec("PRAGMA temp_store = MEMORY;");
    this.db.exec("PRAGMA mmap_size = 268435456;"); // 256MB

    // Auto-vacuum for space management
    this.db.exec("PRAGMA auto_vacuum = INCREMENTAL;");
  }

  private prepareMigrationStatements(): void {
    // Prepare frequently used statements
    this.insertStatement = this.db.prepare(`
      INSERT INTO sensor_data (
        sensorMac, temperature, humidity, timestamp, pressure, batteryVoltage,
        txPower, movementCounter, measurementSequence, accelerationX, accelerationY, accelerationZ
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.latestReadingsStatement = this.db.prepare(`
      SELECT
        sensorMac,
        temperature,
        humidity,
        timestamp,
        pressure,
        batteryVoltage,
        txPower,
        ? - timestamp as secondsAgo
      FROM (
        SELECT
          sensorMac,
          temperature,
          humidity,
          timestamp,
          pressure,
          batteryVoltage,
          txPower,
          ROW_NUMBER() OVER (PARTITION BY sensorMac ORDER BY timestamp DESC) as rn
        FROM sensor_data
      ) latest
      WHERE rn = 1
      ORDER BY sensorMac
    `);

    this.getSensorNamesStatement = this.db.prepare(`
      SELECT sensorMac, customName, createdAt, updatedAt
      FROM sensor_names
      ORDER BY sensorMac
    `);

    this.setSensorNameStatement = this.db.prepare(`
      INSERT OR REPLACE INTO sensor_names (sensorMac, customName, updatedAt)
      VALUES (?, ?, strftime('%s', 'now'))
    `);

    this.deleteSensorNameStatement = this.db.prepare(`
      DELETE FROM sensor_names WHERE sensorMac = ?
    `);
  }

  private async runMigrationsIfNeeded(): Promise<void> {
    try {
      const status = await this.migrationManager.getStatus();

      if (!status.isUpToDate) {
        console.log(
          `🔄 Running ${status.pendingMigrations.length} pending migrations...`,
        );
        const applied = await this.migrationManager.runMigrations();
        console.log(`✅ Applied ${applied.length} migrations successfully`);
      } else {
        console.log("✅ Database schema is up to date");
      }
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    return await this.migrationManager.getStatus();
  }

  async checkDatabaseHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.migrationManager.checkHealth();
      if (!isHealthy) {
        console.warn(
          "⚠️ Database health check failed - migrations table missing",
        );
      }
      return isHealthy;
    } catch (error) {
      console.error("❌ Database health check error:", error);
      return false;
    }
  }

  saveSensorData(data: SensorData): void {
    // Validate input data to prevent injection
    if (!data.sensorMac || typeof data.sensorMac !== "string") {
      throw new Error("Invalid sensor MAC address");
    }

    if (typeof data.temperature !== "number" || isNaN(data.temperature)) {
      throw new Error("Invalid temperature value");
    }

    if (typeof data.timestamp !== "number" || data.timestamp <= 0) {
      throw new Error("Invalid timestamp");
    }

    // Sanitize MAC address (only allow hex and colons/dashes)
    const sanitizedMac = data.sensorMac
      .toLowerCase()
      .replace(/[^a-f0-9:-]/g, "");

    // Use prepared statement for better performance
    this.insertStatement.run(
      [
        sanitizedMac,
        data.temperature,
        data.humidity,
        data.timestamp,
        data.pressure,
        data.batteryVoltage,
        data.txPower,
        data.movementCounter,
        data.measurementSequence,
        data.accelerationX,
        data.accelerationY,
        data.accelerationZ,
      ],
      function (err) {
        if (err) {
          console.error("Database insert error:", err);
        }
      },
    );
  }

  saveSensorDataBatch(dataArray: SensorData[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!dataArray || dataArray.length === 0) {
        resolve();
        return;
      }

      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");

        let errors = 0;
        let completed = 0;

        dataArray.forEach((data) => {
          try {
            // Validate and sanitize each item
            if (!data.sensorMac || typeof data.sensorMac !== "string") {
              errors++;
              return;
            }

            if (
              typeof data.temperature !== "number" ||
              isNaN(data.temperature)
            ) {
              errors++;
              return;
            }

            if (typeof data.timestamp !== "number" || data.timestamp <= 0) {
              errors++;
              return;
            }

            const sanitizedMac = data.sensorMac
              .toLowerCase()
              .replace(/[^a-f0-9:-]/g, "");

            this.insertStatement.run(
              [
                sanitizedMac,
                data.temperature,
                data.humidity,
                data.timestamp,
                data.pressure,
                data.batteryVoltage,
                data.txPower,
                data.movementCounter,
                data.measurementSequence,
                data.accelerationX,
                data.accelerationY,
                data.accelerationZ,
              ],
              function (err) {
                if (err) {
                  errors++;
                  console.error("Batch insert error:", err);
                }
                completed++;

                if (completed === dataArray.length) {
                  if (errors > 0) {
                    console.warn(
                      `Batch insert completed with ${errors} errors out of ${dataArray.length} items`,
                    );
                  }

                  this.run("COMMIT", (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve();
                    }
                  });
                }
              },
            );
          } catch (error) {
            errors++;
            completed++;

            if (completed === dataArray.length) {
              this.db.run("COMMIT", (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          }
        });
      });
    });
  }

  getHistoricalData(timeRange: string): Promise<HistoricalDataRow[]> {
    return new Promise((resolve, reject) => {
      // Validate timeRange input to prevent injection
      const allowedRanges = {
        hour: 1,
        day: 24,
        week: 168,
        month: 720,
        year: 8760,
      };
      const sanitizedRange = timeRange.toLowerCase().replace(/[^a-z]/g, "");

      if (!Object.keys(allowedRanges).includes(sanitizedRange)) {
        reject(new Error("Invalid time range specified"));
        return;
      }

      const hours = allowedRanges[sanitizedRange as keyof typeof allowedRanges];
      const since = Math.floor(Date.now() / 1000) - hours * 60 * 60;

      // Add LIMIT to prevent excessive data retrieval
      this.db.all(
        "SELECT sensorMac, temperature, humidity, timestamp FROM sensor_data WHERE timestamp > ? ORDER BY timestamp LIMIT 10000",
        [since],
        (err, rows) => {
          if (err) {
            console.error("Database query error:", err);
            reject(err);
          } else {
            resolve(rows as HistoricalDataRow[]);
          }
        },
      );
    });
  }

  getAggregatedHistoricalData(timeRange: string): Promise<AggregatedDataRow[]> {
    return new Promise((resolve, reject) => {
      // Validate timeRange input to prevent injection
      const allowedRanges = {
        hour: 1,
        day: 24,
        week: 168,
        month: 720,
        year: 8760,
      };
      const sanitizedRange = timeRange.toLowerCase().replace(/[^a-z]/g, "");

      if (!Object.keys(allowedRanges).includes(sanitizedRange)) {
        reject(new Error("Invalid time range specified"));
        return;
      }

      // Define bucket sizes (in seconds)
      const bucketConfigs = {
        hour: 300, // 5 minutes
        day: 3600, // 1 hour
        week: 21600, // 6 hours
        month: 86400, // 1 day
        year: 2592000, // 30 days (month)
      };

      const hours = allowedRanges[sanitizedRange as keyof typeof allowedRanges];
      const bucketSeconds =
        bucketConfigs[sanitizedRange as keyof typeof bucketConfigs];
      const since = Math.floor(Date.now() / 1000) - hours * 60 * 60;

      // SQLite query with time bucketing (working with seconds)
      const query = `
        SELECT
          sensorMac,
          CAST((timestamp / ?) AS INTEGER) * ? as timestamp,
          AVG(temperature) as avgTemperature,
          MIN(temperature) as minTemperature,
          MAX(temperature) as maxTemperature,
          AVG(humidity) as avgHumidity,
          MIN(humidity) as minHumidity,
          MAX(humidity) as maxHumidity,
          COUNT(*) as dataPoints
        FROM sensor_data
        WHERE timestamp > ?
        GROUP BY sensorMac, CAST((timestamp / ?) AS INTEGER)
        ORDER BY timestamp, sensorMac
        LIMIT 2000
      `;

      this.db.all(
        query,
        [bucketSeconds, bucketSeconds, since, bucketSeconds],
        (err, rows) => {
          if (err) {
            console.error("Database aggregation query error:", err);
            reject(err);
          } else {
            // Round numeric values for cleaner output
            const processedRows = (rows as any[]).map((row) => ({
              sensorMac: row.sensorMac,
              timestamp: Math.floor(row.timestamp),
              avgTemperature: Math.round(row.avgTemperature * 100) / 100,
              minTemperature: Math.round(row.minTemperature * 100) / 100,
              maxTemperature: Math.round(row.maxTemperature * 100) / 100,
              avgHumidity: row.avgHumidity
                ? Math.round(row.avgHumidity * 100) / 100
                : null,
              minHumidity: row.minHumidity
                ? Math.round(row.minHumidity * 100) / 100
                : null,
              maxHumidity: row.maxHumidity
                ? Math.round(row.maxHumidity * 100) / 100
                : null,
              dataPoints: row.dataPoints,
            }));
            resolve(processedRows as AggregatedDataRow[]);
          }
        },
      );
    });
  }

  getLatestSensorReadings(): Promise<LatestSensorReading[]> {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);

      // Use prepared statement for better performance
      this.latestReadingsStatement.all([now], (err, rows) => {
        if (err) {
          console.error("Database latest readings query error:", err);
          reject(err);
        } else {
          const readings = (rows as any[]).map((row) => ({
            sensorMac: row.sensorMac,
            temperature: Math.round(row.temperature * 100) / 100,
            humidity: row.humidity
              ? Math.round(row.humidity * 100) / 100
              : null,
            timestamp: row.timestamp,
            pressure: row.pressure
              ? Math.round(row.pressure * 100) / 100
              : null,
            batteryVoltage: row.batteryVoltage,
            txPower: row.txPower,
            secondsAgo: row.secondsAgo,
          }));
          resolve(readings as LatestSensorReading[]);
        }
      });
    });
  }

  optimizeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Run incremental vacuum to reclaim space
      this.db.run("PRAGMA incremental_vacuum(1000);", (err) => {
        if (err) {
          console.warn("Incremental vacuum failed:", err);
        }

        // Analyze tables for query optimization
        this.db.run("ANALYZE;", (err) => {
          if (err) {
            console.warn("Database analyze failed:", err);
            reject(err);
          } else {
            console.log("Database optimization completed");
            resolve();
          }
        });
      });
    });
  }

  cleanOldData(daysToKeep: number = 365): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoffTime =
        Math.floor(Date.now() / 1000) - daysToKeep * 24 * 60 * 60;

      this.db.run(
        "DELETE FROM sensor_data WHERE timestamp < ?",
        [cutoffTime],
        function (err) {
          if (err) {
            console.error("Failed to clean old data:", err);
            reject(err);
          } else {
            console.log(
              `Cleaned ${this.changes} old records older than ${daysToKeep} days`,
            );
            resolve(this.changes);
          }
        },
      );
    });
  }

  getSensorNames(): Promise<SensorName[]> {
    return new Promise((resolve, reject) => {
      this.getSensorNamesStatement.all([], (err, rows) => {
        if (err) {
          console.error("Database sensor names query error:", err);
          reject(err);
        } else {
          resolve(rows as SensorName[]);
        }
      });
    });
  }

  async setSensorName(sensorMac: string, customName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setSensorNameStatement.run([sensorMac, customName], function (err) {
        if (err) {
          console.error("Database set sensor name error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteSensorName(sensorMac: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.deleteSensorNameStatement.run([sensorMac], function (err) {
        if (err) {
          console.error("Database delete sensor name error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close(): void {
    // Finalize prepared statements
    // if (this.insertStatement) {
    //   this.insertStatement.finalize();
    // }
    // if (this.latestReadingsStatement) {
    //   this.latestReadingsStatement.finalize();
    // }
    // if (this.getSensorNamesStatement) {
    //   this.getSensorNamesStatement.finalize();
    // }
    // if (this.setSensorNameStatement) {
    //   this.setSensorNameStatement.finalize();
    // }
    // if (this.deleteSensorNameStatement) {
    //   this.deleteSensorNameStatement.finalize();
    // }

    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        } else {
          console.log("Database connection closed");
        }
      });
    }
  }
}
