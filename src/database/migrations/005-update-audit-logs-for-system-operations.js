const { getDatabase } = require('../init');

/**
 * Migration: Update audit_logs table to support system operations
 * Allows NULL vote_id for system-level operations like voting settings changes
 */
async function up() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Running migration: Update audit_logs table for system operations');
    
    db.serialize(() => {
      // Create new table with updated schema
      const createNewTableSql = `
        CREATE TABLE IF NOT EXISTS audit_logs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vote_id INTEGER,
          admin_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          reason TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      db.run(createNewTableSql, (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        console.log('✓ Created new audit_logs table with nullable vote_id');
        
        // Copy existing data
        const copyDataSql = `
          INSERT INTO audit_logs_new (id, vote_id, admin_id, operation, reason, metadata, created_at)
          SELECT id, vote_id, admin_id, operation, reason, metadata, created_at
          FROM audit_logs
        `;
        
        db.run(copyDataSql, (err) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          console.log('✓ Copied existing audit log data');
          
          // Drop old table
          db.run('DROP TABLE audit_logs', (err) => {
            if (err) {
              db.close();
              return reject(err);
            }
            
            console.log('✓ Dropped old audit_logs table');
            
            // Rename new table
            db.run('ALTER TABLE audit_logs_new RENAME TO audit_logs', (err) => {
              if (err) {
                db.close();
                return reject(err);
              }
              
              console.log('✓ Renamed new table to audit_logs');
              
              // Recreate indexes
              const indexes = [
                {
                  name: 'idx_audit_logs_vote_id',
                  sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_vote_id ON audit_logs(vote_id)',
                  description: 'Index on vote_id for fast vote history lookup'
                },
                {
                  name: 'idx_audit_logs_admin_id',
                  sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id)',
                  description: 'Index on admin_id for admin operation history'
                },
                {
                  name: 'idx_audit_logs_created_at',
                  sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
                  description: 'Index on created_at for chronological queries'
                },
                {
                  name: 'idx_audit_logs_operation',
                  sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation)',
                  description: 'Index on operation type for filtering'
                }
              ];
              
              let indexesCreated = 0;
              
              indexes.forEach((index) => {
                db.run(index.sql, (err) => {
                  if (err) {
                    console.error(`Failed to create ${index.name}:`, err);
                    db.close();
                    return reject(err);
                  }
                  
                  console.log(`✓ Created ${index.name}: ${index.description}`);
                  indexesCreated++;
                  
                  if (indexesCreated === indexes.length) {
                    db.close();
                    console.log('✓ Audit logs table update migration completed successfully');
                    resolve();
                  }
                });
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Rollback migration - revert to original schema
 */
async function down() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Rolling back migration: Revert audit_logs table schema');
    
    db.serialize(() => {
      // Create original table with NOT NULL vote_id
      const createOriginalTableSql = `
        CREATE TABLE IF NOT EXISTS audit_logs_original (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vote_id INTEGER NOT NULL,
          admin_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('deactivate', 'activate')),
          reason TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      db.run(createOriginalTableSql, (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // Copy only records with non-null vote_id
        const copyDataSql = `
          INSERT INTO audit_logs_original (id, vote_id, admin_id, operation, reason, metadata, created_at)
          SELECT id, vote_id, admin_id, operation, reason, metadata, created_at
          FROM audit_logs
          WHERE vote_id IS NOT NULL
        `;
        
        db.run(copyDataSql, (err) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          // Drop current table and rename
          db.run('DROP TABLE audit_logs', (err) => {
            if (err) {
              db.close();
              return reject(err);
            }
            
            db.run('ALTER TABLE audit_logs_original RENAME TO audit_logs', (err) => {
              db.close();
              if (err) {
                return reject(err);
              }
              
              console.log('✓ Audit logs table rollback completed');
              resolve();
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
  description: 'Update audit_logs table to support system operations with nullable vote_id'
};