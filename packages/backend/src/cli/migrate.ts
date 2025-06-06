#!/usr/bin/env node

import * as sqlite3 from "sqlite3";
import { MigrationManager } from "../migration-manager.js";

const DEFAULT_DB_PATH = process.env.DB_PATH || "ruuvi.db";

class MigrateCLI {
  private db: sqlite3.Database;
  private migrationManager: MigrationManager;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.migrationManager = new MigrationManager(this.db);
  }

  async status(): Promise<void> {
    try {
      const status = await this.migrationManager.getStatus();

      console.log("📊 Migration Status");
      console.log("==================");
      console.log(
        `Database is up to date: ${status.isUpToDate ? "✅ Yes" : "❌ No"}`,
      );
      console.log(`Applied migrations: ${status.appliedMigrations.length}`);
      console.log(`Pending migrations: ${status.pendingMigrations.length}`);

      if (status.lastMigration) {
        console.log(`Last migration: ${status.lastMigration}`);
      }

      if (status.appliedMigrations.length > 0) {
        console.log("\n📋 Applied Migrations:");
        status.appliedMigrations.forEach((id) => console.log(`  ✅ ${id}`));
      }

      if (status.pendingMigrations.length > 0) {
        console.log("\n⏳ Pending Migrations:");
        status.pendingMigrations.forEach((id) => console.log(`  ⏳ ${id}`));
      }
    } catch (error) {
      console.error("❌ Failed to get migration status:", error);
      process.exit(1);
    }
  }

  async migrate(): Promise<void> {
    try {
      console.log("🔄 Running database migrations...");
      const applied = await this.migrationManager.runMigrations();

      if (applied.length === 0) {
        console.log("✅ Database is already up to date");
      } else {
        console.log(`✅ Successfully applied ${applied.length} migrations:`);
        applied.forEach((id) => console.log(`  ✅ ${id}`));
      }
    } catch (error) {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  }

  async rollback(migrationId?: string): Promise<void> {
    try {
      console.log(
        `🔄 Rolling back migration${migrationId ? ` ${migrationId}` : ""}...`,
      );
      await this.migrationManager.rollback(migrationId);
      console.log("✅ Rollback completed successfully");
    } catch (error) {
      console.error("❌ Rollback failed:", error);
      process.exit(1);
    }
  }

  async health(): Promise<void> {
    try {
      const isHealthy = await this.migrationManager.checkHealth();
      console.log(
        `🏥 Database Health: ${isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`,
      );

      if (!isHealthy) {
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Health check failed:", error);
      process.exit(1);
    }
  }

  close(): void {
    this.db.close();
  }
}

function printUsage(): void {
  console.log(`
🗃️  Ruuvi Database Migration Tool

Usage: node dist/cli/migrate.js [command] [options]

Commands:
  status                    Show migration status
  migrate                   Run pending migrations
  rollback [migration_id]   Rollback latest or specific migration
  health                    Check database health

Options:
  --db-path <path>         Database file path (default: ${DEFAULT_DB_PATH})
  --help                   Show this help message

Examples:
  node dist/cli/migrate.js status
  node dist/cli/migrate.js migrate
  node dist/cli/migrate.js rollback
  node dist/cli/migrate.js rollback 001_create_sensor_data_table
  node dist/cli/migrate.js health --db-path /path/to/custom.db
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const dbPathIndex = args.indexOf("--db-path");
  const dbPath =
    dbPathIndex !== -1 && args[dbPathIndex + 1]
      ? args[dbPathIndex + 1]
      : DEFAULT_DB_PATH;

  const command = args[0];
  const cli = new MigrateCLI(dbPath || DEFAULT_DB_PATH);

  try {
    switch (command) {
      case "status":
        await cli.status();
        break;
      case "migrate":
        await cli.migrate();
        break;
      case "rollback":
        const migrationId =
          args[1] && !args[1].startsWith("--") ? args[1] : undefined;
        await cli.rollback(migrationId);
        break;
      case "health":
        await cli.health();
        break;
      default:
        console.error(`❌ Unknown command: ${command || "(none)"}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    cli.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}
