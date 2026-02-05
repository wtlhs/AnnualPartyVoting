const { getDatabase, releaseConnection } = require('../init');

/**
 * Migration: Create guests table for managing guest users
 * Allows admins to pre-approve guest registrations alongside employee roster
 */
async function up() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    console.log('Running migration: Create guests table');

    db.serialize(() => {
      // Create guests table
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS guests (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
          source TEXT CHECK(source IN ('admin', 'self')) DEFAULT 'admin',
          added_by TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_guest_name_gender UNIQUE (name, gender)
        )
      `;

      db.run(createTableSql, (err) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }

        console.log('✓ Created guests table');

        // Create indexes for performance
        const indexes = [
          {
            name: 'idx_guests_name',
            sql: 'CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name)',
            description: 'Index on name for fast lookup'
          },
          {
            name: 'idx_guests_gender',
            sql: 'CREATE INDEX IF NOT EXISTS idx_guests_gender ON guests(gender)',
            description: 'Index on gender for filtering'
          },
          {
            name: 'idx_guests_source',
            sql: 'CREATE INDEX IF NOT EXISTS idx_guests_source ON guests(source)',
            description: 'Index on source for filtering'
          },
          {
            name: 'idx_guests_created_at',
            sql: 'CREATE INDEX IF NOT EXISTS idx_guests_created_at ON guests(created_at)',
            description: 'Index on created_at for chronological queries'
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
              console.log('✓ Guests table migration completed successfully');
              resolve();
            }
          });
        });
      });
    });
  });
}

/**
 * Rollback migration - drop guests table
 */
async function down() {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    console.log('Rolling back migration: Drop guests table');

    db.run('DROP TABLE IF EXISTS guests', (err) => {
      if (err) {
        releaseConnection(db);
        return reject(err);
      }

      console.log('✓ Guests table dropped');
      releaseConnection(db);
      console.log('✓ Guests table rollback completed');
      resolve();
    });
  });
}

module.exports = {
  up,
  down,
  description: 'Create guests table for managing pre-approved guest registrations'
};
