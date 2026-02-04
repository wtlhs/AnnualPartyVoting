const { getDatabase } = require('./init');
const fs = require('fs');
const path = require('path');

/**
 * Database migration runner for admin vote records functionality
 * Manages database schema changes and tracks migration history
 */

/**
 * Create migrations table to track applied migrations
 */
async function createMigrationsTable() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        description TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.run(sql, (err) => {
      db.close();
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.all('SELECT filename FROM migrations ORDER BY applied_at', (err, rows) => {
      db.close();
      if (err) {
        return reject(err);
      }
      resolve(rows.map(row => row.filename));
    });
  });
}

/**
 * Record a migration as applied
 */
async function recordMigration(filename, description) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = 'INSERT INTO migrations (filename, description) VALUES (?, ?)';
    
    db.run(sql, [filename, description], (err) => {
      db.close();
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log('Applied migrations:', appliedMigrations);
    
    // Get available migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    console.log('Available migration files:', migrationFiles);
    
    // Run pending migrations
    for (const filename of migrationFiles) {
      if (!appliedMigrations.includes(filename)) {
        console.log(`Running migration: ${filename}`);
        
        try {
          const migrationPath = path.join(migrationsDir, filename);
          const migration = require(migrationPath);
          
          // Run the migration
          await migration.up();
          
          // Record as applied
          await recordMigration(filename, migration.description || 'No description');
          
          console.log(`✓ Migration ${filename} completed successfully`);
        } catch (error) {
          console.error(`✗ Migration ${filename} failed:`, error);
          throw error;
        }
      } else {
        console.log(`Skipping already applied migration: ${filename}`);
      }
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the last migration
 */
async function rollbackLastMigration() {
  try {
    console.log('Rolling back last migration...');
    
    // Get the last applied migration
    const db = getDatabase();
    
    const lastMigration = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM migrations ORDER BY applied_at DESC LIMIT 1', (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!lastMigration) {
      console.log('No migrations to rollback');
      return;
    }
    
    console.log(`Rolling back migration: ${lastMigration.filename}`);
    
    // Load and run the rollback
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationPath = path.join(migrationsDir, lastMigration.filename);
    const migration = require(migrationPath);
    
    if (migration.down) {
      await migration.down();
      
      // Remove from migrations table
      const removeDb = getDatabase();
      await new Promise((resolve, reject) => {
        removeDb.run('DELETE FROM migrations WHERE filename = ?', [lastMigration.filename], (err) => {
          removeDb.close();
          if (err) return reject(err);
          resolve();
        });
      });
      
      console.log(`✓ Migration ${lastMigration.filename} rolled back successfully`);
    } else {
      console.log(`Migration ${lastMigration.filename} does not support rollback`);
    }
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

module.exports = {
  runMigrations,
  rollbackLastMigration,
  getAppliedMigrations,
  createMigrationsTable
};