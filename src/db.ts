import * as sqlite3 from 'sqlite3';

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
    this.initializeDatabase(dbPath);
  }

  private initializeDatabase(dbPath: string): void {
    this.db = new sqlite3.Database(dbPath);
    this.createTables();
    this.createIndexes();
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
    this.db.run(
      `INSERT INTO sensor_data (
        sensorMac, temperature, humidity, timestamp, pressure, batteryVoltage, 
        txPower, movementCounter, measurementSequence, accelerationX, accelerationY, accelerationZ
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.sensorMac, data.temperature, data.humidity, data.timestamp,
        data.pressure, data.batteryVoltage, data.txPower, data.movementCounter,
        data.measurementSequence, data.accelerationX, data.accelerationY, data.accelerationZ
      ]
    );
  }

  getHistoricalData(timeRange: string): Promise<HistoricalDataRow[]> {
    return new Promise((resolve, reject) => {
      const ranges = { day: 24, week: 168, month: 720, year: 8760 };
      const hours = ranges[timeRange as keyof typeof ranges] || 24;
      const since = Date.now() - (hours * 60 * 60 * 1000);

      this.db.all(
        'SELECT sensorMac, temperature, humidity, timestamp FROM sensor_data WHERE timestamp > ? ORDER BY timestamp',
        [since],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows as HistoricalDataRow[]);
          }
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}