import { Migration } from "../migration-manager.js";

const migration: Migration = {
  id: "002_create_sensor_names_table",
  description: "Create sensor_names table for custom sensor naming",
  up: `
    CREATE TABLE sensor_names (
      sensorMac TEXT PRIMARY KEY,
      customName TEXT NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX idx_sensor_names_updated ON sensor_names(updatedAt);
  `,
  down: `
    DROP INDEX IF EXISTS idx_sensor_names_updated;
    DROP TABLE IF EXISTS sensor_names;
  `,
};

export default migration;
