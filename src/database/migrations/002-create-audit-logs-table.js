const { getDatabase, releaseConnection } = require('../init');

/**
 * Migration: Create audit_logs table for tracking admin operations
 * Creates table to store admin operations on vote records with proper indexing
 */
async function up() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();
    
    console.log('Running migration: Create audit_logs table');
    
    db.serialize(() => {
      // Create audit_logs table
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS audit_logs (
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
      
      db.run(createTableSql, (err) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }
        
        console.log('✓ Created audit_logs table');
        
        // Create indexes for performance optimization
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
              releaseConnection(db);
              return reject(err);
            }
            
            console.log(`✓ Created ${index.name}: ${index.description}`);
            indexesCreated++;
            
            if (indexesCreated === indexes.length) {
              releaseConnection(db);
              console.log('✓ Audit logs table creation migration completed successfully');
              resolve();
            }
          });
        });
      });
    });
  });
}

/**
 * Rollback migration - drop audit_logs table and indexes
 */
async function down() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();
    
    console.log('Rolling back migration: Drop audit_logs table');
    
    db.serialize(() => {
      // Drop indexes first
      const dropIndexes = [
        'DROP INDEX IF EXISTS idx_audit_logs_vote_id',
        'DROP INDEX IF EXISTS idx_audit_logs_admin_id', 
        'DROP INDEX IF EXISTS idx_audit_logs_created_at',
        'DROP INDEX IF EXISTS idx_audit_logs_operation'
      ];
      
      let indexesDropped = 0;
      
      dropIndexes.forEach((sql) => {
        db.run(sql, (err) => {
          if (err) {
            console.error('Failed to drop index:', err);
            releaseConnection(db);
            return reject(err);
          }
          
          indexesDropped++;
          
          if (indexesDropped === dropIndexes.length) {
            // Drop the table
            db.run('DROP TABLE IF EXISTS audit_logs', (err) => {
              releaseConnection(db);
              if (err) {
                return reject(err);
              }
              
              console.log('✓ Audit logs table rollback completed');
              resolve();
            });
          }
        });
      });
    });
  });
}

module.exports = {
  up,
  down,
  description: 'Create audit_logs table for tracking admin operations on vote records'
};