import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  id: string;
  description: string;
  up: string;
  down?: string;
}

export interface MigrationStatus {
  isUpToDate: boolean;
  appliedMigrations: string[];
  pendingMigrations: string[];
  lastMigration: string | null;
}

export class MigrationManager {
  private db: sqlite3.Database;
  private migrationsPath: string;

  constructor(db: sqlite3.Database, migrationsPath: string = './dist/migrations') {
    this.db = db;
    this.migrationsPath = path.resolve(migrationsPath);
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
      `);
    } catch (error) {
      console.error('Failed to create schema_migrations table:', error);
      throw error;
    }
  }

  private loadMigrations(): Migration[] {
    const migrations: Migration[] = [];
    
    if (!fs.existsSync(this.migrationsPath)) {
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();

    for (const file of files) {
      try {
        const migrationPath = path.join(this.migrationsPath, file);
        const migration = require(migrationPath).default || require(migrationPath);
        
        if (migration && migration.id && migration.up) {
          migrations.push(migration);
        }
      } catch (error) {
        console.warn(`Failed to load migration ${file}:`, error);
      }
    }

    return migrations;
  }

  getStatus(): Promise<MigrationStatus> {
    return new Promise((resolve, reject) => {
      const allMigrations = this.loadMigrations();
      
      this.db.all(
        'SELECT id FROM schema_migrations ORDER BY applied_at',
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const appliedIds = (rows as any[]).map(row => row.id);
          const allIds = allMigrations.map(m => m.id);
          const pendingIds = allIds.filter(id => !appliedIds.includes(id));

          resolve({
            isUpToDate: pendingIds.length === 0,
            appliedMigrations: appliedIds,
            pendingMigrations: pendingIds,
            lastMigration: appliedIds.length > 0 ? appliedIds[appliedIds.length - 1] : null
          });
        }
      );
    });
  }

  runMigrations(): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const status = await this.getStatus();
        
        if (status.isUpToDate) {
          resolve([]);
          return;
        }

        const allMigrations = this.loadMigrations();
        const pendingMigrations = allMigrations.filter(m => 
          status.pendingMigrations.includes(m.id)
        );

        const appliedMigrations: string[] = [];

        for (const migration of pendingMigrations) {
          try {
            await this.runSingleMigration(migration);
            appliedMigrations.push(migration.id);
            console.log(`✅ Applied migration: ${migration.id} - ${migration.description}`);
          } catch (error) {
            console.error(`❌ Failed to apply migration ${migration.id}:`, error);
            reject(new Error(`Migration failed: ${migration.id}`));
            return;
          }
        }

        resolve(appliedMigrations);
      } catch (error) {
        reject(error);
      }
    });
  }

  private runSingleMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        this.db.run(migration.up, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }

          this.db.run(
            'INSERT INTO schema_migrations (id, description) VALUES (?, ?)',
            [migration.id, migration.description],
            (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }

              this.db.run('COMMIT', (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          );
        });
      });
    });
  }

  rollback(migrationId?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const status = await this.getStatus();
        const targetId = migrationId || status.lastMigration;
        
        if (!targetId) {
          reject(new Error('No migrations to rollback'));
          return;
        }

        const allMigrations = this.loadMigrations();
        const migration = allMigrations.find(m => m.id === targetId);
        
        if (!migration) {
          reject(new Error(`Migration not found: ${targetId}`));
          return;
        }

        if (!migration.down) {
          reject(new Error(`Migration ${targetId} has no rollback script`));
          return;
        }

        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');
          
          this.db.run(migration.down!, (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }

            this.db.run(
              'DELETE FROM schema_migrations WHERE id = ?',
              [targetId],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                this.db.run('COMMIT', (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    console.log(`✅ Rolled back migration: ${targetId}`);
                    resolve();
                  }
                });
              }
            );
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  checkHealth(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="schema_migrations"',
        (err, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count === 1);
          }
        }
      );
    });
  }
}