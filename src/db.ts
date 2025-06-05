import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationManager, MigrationStatus } from './migration-manager';

export interface SensorData {
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

export interface HistoricalDataRow {
  sensorMac: string;
  temperature: number;
  humidity: number | null;
  timestamp: number;
}

export interface AggregatedDataRow {
  sensorMac: string;
  timestamp: number; // bucket start timestamp
  avgTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  avgHumidity: number | null;
  minHumidity: number | null;
  maxHumidity: number | null;
  dataPoints: number; // count of data points in bucket
}

export class Database {
  private db!: sqlite3.Database;
  private migrationManager!: MigrationManager;

  constructor(dbPath: string = 'ruuvi.db') {
    const validatedPath = this.validateAndSecurePath(dbPath);
    this.initializeDatabase(validatedPath);
  }

  async initialize(): Promise<void> {
    await this.runMigrationsIfNeeded();
  }

  private validateAndSecurePath(dbPath: string): string {
    // Prevent directory traversal attacks
    const normalizedPath = path.normalize(dbPath);
    const resolvedPath = path.resolve(normalizedPath);
    const basePath = path.resolve(process.cwd());
    
    // Ensure database file stays within application directory
    if (!resolvedPath.startsWith(basePath)) {
      throw new Error('Database path must be within application directory');
    }
    
    // Only allow .db extension
    if (!resolvedPath.endsWith('.db')) {
      throw new Error('Database file must have .db extension');
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
      
      this.migrationManager = new MigrationManager(this.db);
      console.log(`Database connection established: ${dbPath}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async runMigrationsIfNeeded(): Promise<void> {
    try {
      const status = await this.migrationManager.getStatus();
      
      if (!status.isUpToDate) {
        console.log(`🔄 Running ${status.pendingMigrations.length} pending migrations...`);
        const applied = await this.migrationManager.runMigrations();
        console.log(`✅ Applied ${applied.length} migrations successfully`);
      } else {
        console.log('✅ Database schema is up to date');
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
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
        console.warn('⚠️ Database health check failed - migrations table missing');
      }
      return isHealthy;
    } catch (error) {
      console.error('❌ Database health check error:', error);
      return false;
    }
  }

  saveSensorData(data: SensorData): void {
    // Validate input data to prevent injection
    if (!data.sensorMac || typeof data.sensorMac !== 'string') {
      throw new Error('Invalid sensor MAC address');
    }
    
    if (typeof data.temperature !== 'number' || isNaN(data.temperature)) {
      throw new Error('Invalid temperature value');
    }
    
    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      throw new Error('Invalid timestamp');
    }

    // Sanitize MAC address (only allow hex and colons/dashes)
    const sanitizedMac = data.sensorMac.toLowerCase().replace(/[^a-f0-9:-]/g, '');
    
    this.db.run(
      `INSERT INTO sensor_data (
        sensorMac, temperature, humidity, timestamp, pressure, batteryVoltage, 
        txPower, movementCounter, measurementSequence, accelerationX, accelerationY, accelerationZ
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sanitizedMac, data.temperature, data.humidity, data.timestamp,
        data.pressure, data.batteryVoltage, data.txPower, data.movementCounter,
        data.measurementSequence, data.accelerationX, data.accelerationY, data.accelerationZ
      ],
      function(err) {
        if (err) {
          console.error('Database insert error:', err);
        }
      }
    );
  }

  getHistoricalData(timeRange: string): Promise<HistoricalDataRow[]> {
    return new Promise((resolve, reject) => {
      // Validate timeRange input to prevent injection
      const allowedRanges = { day: 24, week: 168, month: 720, year: 8760 };
      const sanitizedRange = timeRange.toLowerCase().replace(/[^a-z]/g, '');
      
      if (!Object.keys(allowedRanges).includes(sanitizedRange)) {
        reject(new Error('Invalid time range specified'));
        return;
      }
      
      const hours = allowedRanges[sanitizedRange as keyof typeof allowedRanges];
      const since = Date.now() - (hours * 60 * 60 * 1000);

      // Add LIMIT to prevent excessive data retrieval
      this.db.all(
        'SELECT sensorMac, temperature, humidity, timestamp FROM sensor_data WHERE timestamp > ? ORDER BY timestamp LIMIT 10000',
        [since],
        (err, rows) => {
          if (err) {
            console.error('Database query error:', err);
            reject(err);
          } else {
            resolve(rows as HistoricalDataRow[]);
          }
        }
      );
    });
  }

  getAggregatedHistoricalData(timeRange: string): Promise<AggregatedDataRow[]> {
    return new Promise((resolve, reject) => {
      // Validate timeRange input to prevent injection
      const allowedRanges = { hour: 1, day: 24, week: 168, month: 720, year: 8760 };
      const sanitizedRange = timeRange.toLowerCase().replace(/[^a-z]/g, '');
      
      if (!Object.keys(allowedRanges).includes(sanitizedRange)) {
        reject(new Error('Invalid time range specified'));
        return;
      }

      // Define bucket sizes (in seconds)
      const bucketConfigs = {
        hour: 300,     // 5 minutes
        day: 3600,     // 1 hour
        week: 21600,   // 6 hours
        month: 86400,  // 1 day
        year: 2592000  // 30 days (month)
      };

      const hours = allowedRanges[sanitizedRange as keyof typeof allowedRanges];
      const bucketSeconds = bucketConfigs[sanitizedRange as keyof typeof bucketConfigs];
      const bucketMilliseconds = bucketSeconds * 1000;
      const since = Date.now() - (hours * 60 * 60 * 1000);

      // SQLite query with time bucketing (working with milliseconds)
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
        [bucketMilliseconds, bucketMilliseconds, since, bucketMilliseconds],
        (err, rows) => {
          if (err) {
            console.error('Database aggregation query error:', err);
            reject(err);
          } else {
            // Round numeric values for cleaner output
            const processedRows = (rows as any[]).map(row => ({
              sensorMac: row.sensorMac,
              timestamp: Math.floor(row.timestamp),
              avgTemperature: Math.round(row.avgTemperature * 100) / 100,
              minTemperature: Math.round(row.minTemperature * 100) / 100,
              maxTemperature: Math.round(row.maxTemperature * 100) / 100,
              avgHumidity: row.avgHumidity ? Math.round(row.avgHumidity * 100) / 100 : null,
              minHumidity: row.minHumidity ? Math.round(row.minHumidity * 100) / 100 : null,
              maxHumidity: row.maxHumidity ? Math.round(row.maxHumidity * 100) / 100 : null,
              dataPoints: row.dataPoints
            }));
            resolve(processedRows as AggregatedDataRow[]);
          }
        }
      );
    });
  }

  close(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}