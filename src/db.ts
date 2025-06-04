import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

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

export class Database {
  private db!: sqlite3.Database;

  constructor(dbPath: string = 'ruuvi.db') {
    const validatedPath = this.validateAndSecurePath(dbPath);
    this.initializeDatabase(validatedPath);
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
      
      this.createTables();
      this.createIndexes();
      console.log(`Database initialized: ${dbPath}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private createTables(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorMac TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL,
      timestamp INTEGER NOT NULL,
      pressure REAL,
      batteryVoltage INTEGER,
      txPower INTEGER,
      movementCounter INTEGER,
      measurementSequence INTEGER,
      accelerationX REAL,
      accelerationY REAL,
      accelerationZ REAL
    )`);
  }

  private createIndexes(): void {
    this.db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data(timestamp)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_sensor ON sensor_data(sensorMac)');
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