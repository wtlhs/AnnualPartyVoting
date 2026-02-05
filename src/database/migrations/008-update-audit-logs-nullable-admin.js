const { getDatabase, releaseConnection } = require('../init');

/**
 * Migration: Update audit_logs table to allow NULL admin_id for system operations
 * System operations like voting settings changes don't have a specific admin user
 */
async function up() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    console.log('Running migration: Update audit_logs table to allow NULL admin_id');

    db.serialize(() => {
      // Step 1: Copy existing data to a temporary storage
      db.all('SELECT * FROM audit_logs', [], (err, rows) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }

        console.log(`✓ Backed up ${rows.length} audit log records`);

        // Step 2: Drop old table
        db.run('DROP TABLE IF EXISTS audit_logs', (err) => {
          if (err) {
            releaseConnection(db);
            return reject(err);
          }

          console.log('✓ Dropped old audit_logs table');

          // Step 3: Create new table with nullable admin_id
          const createTableSql = `
            CREATE TABLE audit_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              vote_id INTEGER,
              admin_id TEXT,
              operation TEXT NOT NULL,
              reason TEXT,
              metadata TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
            )
          `;

          db.run(createTableSql, (err) => {
            if (err) {
              releaseConnection(db);
              return reject(err);
            }

            console.log('✓ Created new audit_logs table with nullable admin_id');

            // Step 4: Restore data (using INSERT OR IGNORE to skip problematic records)
            if (rows.length > 0) {
              const insertSql = `
                INSERT OR IGNORE INTO audit_logs (id, vote_id, admin_id, operation, reason, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `;

              let inserted = 0;
              const stmt = db.prepare(insertSql);

              rows.forEach((row) => {
                stmt.run(
                  row.id,
                  row.vote_id,
                  row.admin_id,
                  row.operation,
                  row.reason,
                  row.metadata,
                  row.created_at,
                  (err) => {
                    if (!err) inserted++;
                  }
                );
              });

              stmt.finalize((finalizeErr) => {
                if (finalizeErr) {
                  console.warn(`⚠️  Some records could not be restored`);
                }

                console.log(`✓ Restored ${inserted}/${rows.length} audit log records`);

                // Step 5: Recreate indexes
                recreateIndexes(db, resolve, reject);
              });
            } else {
              // No data to restore, just recreate indexes
              recreateIndexes(db, resolve, reject);
            }
          });
        });
      });
    });
  });
}

function recreateIndexes(db, resolve, reject) {
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
      } else {
        console.log(`✓ Created ${index.name}: ${index.description}`);
      }

      indexesCreated++;

      if (indexesCreated === indexes.length) {
        releaseConnection(db);
        console.log('✓ Audit logs table update migration completed successfully');
        resolve();
      }
    });
  });
}

/**
 * Rollback migration
 */
async function down() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    console.log('Rolling back migration: Revert audit_logs table schema');

    db.serialize(() => {
      // Copy existing data
      db.all('SELECT * FROM audit_logs WHERE admin_id IS NOT NULL', [], (err, rows) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }

        console.log(`✓ Backed up ${rows.length} valid audit log records`);

        // Drop current table
        db.run('DROP TABLE IF EXISTS audit_logs', (err) => {
          if (err) {
            releaseConnection(db);
            return reject(err);
          }

          console.log('✓ Dropped current audit_logs table');

          // Recreate with NOT NULL admin_id
          const createTableSql = `
            CREATE TABLE audit_logs (
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

          db.run(createTableSql, (err) => {
            if (err) {
              releaseConnection(db);
              return reject(err);
            }

            console.log('✓ Recreated audit_logs table with NOT NULL admin_id');

            // Restore data
            if (rows.length > 0) {
              const insertSql = `
                INSERT INTO audit_logs (id, vote_id, admin_id, operation, reason, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `;

              let inserted = 0;
              const stmt = db.prepare(insertSql);

              rows.forEach((row) => {
                stmt.run(
                  row.id,
                  row.vote_id,
                  row.admin_id,
                  row.operation,
                  row.reason,
                  row.metadata,
                  row.created_at,
                  (err) => {
                    if (!err) inserted++;
                  }
                );
              });

              stmt.finalize(() => {
                console.log(`✓ Restored ${inserted}/${rows.length} audit log records`);
                recreateIndexesForRollback(db, resolve, reject);
              });
            } else {
              recreateIndexesForRollback(db, resolve, reject);
            }
          });
        });
      });
    });
  });
}

function recreateIndexesForRollback(db, resolve, reject) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_vote_id ON audit_logs(vote_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation)'
  ];

  let indexesCreated = 0;

  indexes.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error('Failed to create index:', err);
      }
      indexesCreated++;
      if (indexesCreated === indexes.length) {
        releaseConnection(db);
        console.log('✓ Audit logs table rollback completed');
        resolve();
      }
    });
  });
}

module.exports = {
  up,
  down,
  description: 'Update audit_logs table to allow NULL admin_id for system operations'
};
