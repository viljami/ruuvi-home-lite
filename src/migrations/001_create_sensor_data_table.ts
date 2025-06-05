import { Migration } from '../migration-manager';

const migration: Migration = {
  id: '001_create_sensor_data_table',
  description: 'Create sensor_data table with indexes',
  up: `
    CREATE TABLE sensor_data (
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
    );
    
    CREATE INDEX idx_timestamp ON sensor_data(timestamp);
    CREATE INDEX idx_sensor ON sensor_data(sensorMac);
  `,
  down: `
    DROP INDEX IF EXISTS idx_sensor;
    DROP INDEX IF EXISTS idx_timestamp;
    DROP TABLE IF EXISTS sensor_data;
  `
};

export default migration;