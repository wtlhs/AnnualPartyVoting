const { getDatabase } = require('../init');

/**
 * Migration: Create export_tasks table for managing data export operations
 * Creates table to track export tasks with file lifecycle management
 */
async function up() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Running migration: Create export_tasks table');
    
    db.serialize(() => {
      // Create export_tasks table
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS export_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL CHECK(file_type IN ('csv', 'excel')),
          filters TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
          error_message TEXT,
          file_size INTEGER,
          record_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          expires_at DATETIME,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      db.run(createTableSql, (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        console.log('✓ Created export_tasks table');
        
        // Create indexes for performance optimization
        const indexes = [
          {
            name: 'idx_export_tasks_admin_id',
            sql: 'CREATE INDEX IF NOT EXISTS idx_export_tasks_admin_id ON export_tasks(admin_id)',
            description: 'Index on admin_id for user export history'
          },
          {
            name: 'idx_export_tasks_status',
            sql: 'CREATE INDEX IF NOT EXISTS idx_export_tasks_status ON export_tasks(status)',
            description: 'Index on status for filtering active tasks'
          },
          {
            name: 'idx_export_tasks_created_at',
            sql: 'CREATE INDEX IF NOT EXISTS idx_export_tasks_created_at ON export_tasks(created_at)',
            description: 'Index on created_at for chronological queries'
          },
          {
            name: 'idx_export_tasks_expires_at',
            sql: 'CREATE INDEX IF NOT EXISTS idx_export_tasks_expires_at ON export_tasks(expires_at)',
            description: 'Index on expires_at for cleanup operations'
          },
          {
            name: 'idx_export_tasks_file_type',
            sql: 'CREATE INDEX IF NOT EXISTS idx_export_tasks_file_type ON export_tasks(file_type)',
            description: 'Index on file_type for format filtering'
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
              // Create a trigger to automatically set expires_at when status becomes 'completed'
              const createTriggerSql = `
                CREATE TRIGGER IF NOT EXISTS set_export_expiry
                AFTER UPDATE OF status ON export_tasks
                WHEN NEW.status = 'completed' AND OLD.status != 'completed'
                BEGIN
                  UPDATE export_tasks 
                  SET expires_at = datetime('now', '+7 days'),
                      completed_at = CURRENT_TIMESTAMP
                  WHERE id = NEW.id;
                END
              `;
              
              db.run(createTriggerSql, (err) => {
                db.close();
                if (err) {
                  console.error('Failed to create expiry trigger:', err);
                  return reject(err);
                }
                
                console.log('✓ Created automatic expiry trigger for completed exports');
                console.log('✓ Export tasks table creation migration completed successfully');
                resolve();
              });
            }
          });
        });
      });
    });
  });
}

/**
 * Rollback migration - drop export_tasks table, indexes, and triggers
 */
async function down() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    console.log('Rolling back migration: Drop export_tasks table');
    
    db.serialize(() => {
      // Drop trigger first
      db.run('DROP TRIGGER IF EXISTS set_export_expiry', (err) => {
        if (err) {
          console.error('Failed to drop trigger:', err);
          db.close();
          return reject(err);
        }
        
        // Drop indexes
        const dropIndexes = [
          'DROP INDEX IF EXISTS idx_export_tasks_admin_id',
          'DROP INDEX IF EXISTS idx_export_tasks_status',
          'DROP INDEX IF EXISTS idx_export_tasks_created_at',
          'DROP INDEX IF EXISTS idx_export_tasks_expires_at',
          'DROP INDEX IF EXISTS idx_export_tasks_file_type'
        ];
        
        let indexesDropped = 0;
        
        dropIndexes.forEach((sql) => {
          db.run(sql, (err) => {
            if (err) {
              console.error('Failed to drop index:', err);
              db.close();
              return reject(err);
            }
            
            indexesDropped++;
            
            if (indexesDropped === dropIndexes.length) {
              // Drop the table
              db.run('DROP TABLE IF EXISTS export_tasks', (err) => {
                db.close();
                if (err) {
                  return reject(err);
                }
                
                console.log('✓ Export tasks table rollback completed');
                resolve();
              });
            }
          });
        });
      });
    });
  });
}

module.exports = {
  up,
  down,
  description: 'Create export_tasks table for managing data export operations with file lifecycle'
};