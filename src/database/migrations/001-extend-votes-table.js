const { getDatabase } = require('../init');

/**
 * Migration: Extend votes table with admin vote records functionality
 * Adds status, user_agent, vote_method, created_at, updated_at fields
 * Note: ip_address already exists in the current votes table
 */
async function up() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Running migration: Extend votes table for admin vote records');
    
    db.serialize(() => {
      // Check current table structure
      db.all("PRAGMA table_info(votes)", (err, columns) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        const existingColumns = columns.map(col => col.name);
        console.log('Current votes table columns:', existingColumns);
        
        const migrations = [];
        
        // Add status column if it doesn't exist
        if (!existingColumns.includes('status')) {
          migrations.push({
            sql: "ALTER TABLE votes ADD COLUMN status TEXT DEFAULT 'active'",
            description: 'Adding status column'
          });
        }
        
        // Add user_agent column if it doesn't exist
        if (!existingColumns.includes('user_agent')) {
          migrations.push({
            sql: "ALTER TABLE votes ADD COLUMN user_agent TEXT",
            description: 'Adding user_agent column'
          });
        }
        
        // Add vote_method column if it doesn't exist
        if (!existingColumns.includes('vote_method')) {
          migrations.push({
            sql: "ALTER TABLE votes ADD COLUMN vote_method TEXT",
            description: 'Adding vote_method column'
          });
        }
        
        // Add created_at column if it doesn't exist
        if (!existingColumns.includes('created_at')) {
          migrations.push({
            sql: "ALTER TABLE votes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
            description: 'Adding created_at column'
          });
        }
        
        // Add updated_at column if it doesn't exist
        if (!existingColumns.includes('updated_at')) {
          migrations.push({
            sql: "ALTER TABLE votes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
            description: 'Adding updated_at column'
          });
        }
        
        if (migrations.length === 0) {
          console.log('All required columns already exist in votes table');
          db.close();
          return resolve();
        }
        
        // Execute migrations
        let completed = 0;
        migrations.forEach((migration, index) => {
          console.log(`${migration.description}...`);
          
          db.run(migration.sql, (err) => {
            if (err) {
              console.error(`Failed: ${migration.description}`, err);
              db.close();
              return reject(err);
            }
            
            console.log(`✓ ${migration.description} completed`);
            completed++;
            
            if (completed === migrations.length) {
              // Update existing records to have proper timestamps and status
              updateExistingRecords(db)
                .then(() => {
                  db.close();
                  console.log('✓ Votes table extension migration completed successfully');
                  resolve();
                })
                .catch((err) => {
                  db.close();
                  reject(err);
                });
            }
          });
        });
      });
    });
  });
}

/**
 * Update existing vote records with proper timestamps and status
 */
async function updateExistingRecords(db) {
  return new Promise((resolve, reject) => {
    // Update existing records that don't have created_at set
    const updateSql = `
      UPDATE votes 
      SET created_at = COALESCE(created_at, vote_time, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, vote_time, CURRENT_TIMESTAMP),
          status = COALESCE(status, 'active')
      WHERE created_at IS NULL OR updated_at IS NULL OR status IS NULL
    `;
    
    db.run(updateSql, (err) => {
      if (err) {
        console.error('Failed to update existing records:', err);
        return reject(err);
      }
      
      console.log('✓ Updated existing vote records with proper timestamps and status');
      resolve();
    });
  });
}

/**
 * Rollback migration (remove added columns)
 * Note: SQLite doesn't support DROP COLUMN, so this creates a new table without the columns
 */
async function down() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Rolling back migration: Remove votes table extensions');
    
    db.serialize(() => {
      // Create backup table with original structure
      const createBackupSql = `
        CREATE TABLE votes_backup AS
        SELECT id, voter_id, target_user_id, vote_time, ip_address
        FROM votes
      `;
      
      db.run(createBackupSql, (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // Drop original table
        db.run('DROP TABLE votes', (err) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          // Recreate original table structure
          const createOriginalSql = `
            CREATE TABLE votes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              voter_id TEXT,
              target_user_id TEXT NOT NULL,
              vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              ip_address TEXT,
              FOREIGN KEY (target_user_id) REFERENCES users(id)
            )
          `;
          
          db.run(createOriginalSql, (err) => {
            if (err) {
              db.close();
              return reject(err);
            }
            
            // Restore data
            const restoreDataSql = `
              INSERT INTO votes (id, voter_id, target_user_id, vote_time, ip_address)
              SELECT id, voter_id, target_user_id, vote_time, ip_address
              FROM votes_backup
            `;
            
            db.run(restoreDataSql, (err) => {
              if (err) {
                db.close();
                return reject(err);
              }
              
              // Drop backup table
              db.run('DROP TABLE votes_backup', (err) => {
                db.close();
                if (err) {
                  return reject(err);
                }
                
                console.log('✓ Votes table extension rollback completed');
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

module.exports = {
  up,
  down,
  description: 'Extend votes table with status, user_agent, vote_method, created_at, updated_at fields'
};