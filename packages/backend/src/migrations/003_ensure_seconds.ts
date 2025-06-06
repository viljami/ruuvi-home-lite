import { Migration } from "../migration-manager.js";

const migration: Migration = {
  id: "003_ensure_seconds",
  description: "Ensure all timestamps are in seconds",
  up: `
    UPDATE sensor_data set timestamp = timestamp / 1000 WHERE timestamp > cast(unixepoch('subsecond') as int);
  `,
  down: `
    SELECT 1;
  `,
};

export default migration;
