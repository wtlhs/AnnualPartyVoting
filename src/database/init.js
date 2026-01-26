const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = path.join(__dirname, '../../data/voting.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
function createConnection() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      throw err;
    }
  });
}

// Initialize database tables
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON');
    
    // Create users table (without numeric_id initially for compatibility)
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT CHECK(gender IN ('male', 'female')) NOT NULL,
        avatar_url TEXT,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create votes table
    const createVotesTable = `
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT,
        target_user_id TEXT NOT NULL,
        vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        FOREIGN KEY (target_user_id) REFERENCES users(id)
      )
    `;
    
    // Create vote_restrictions table
    const createVoteRestrictionsTable = `
      CREATE TABLE IF NOT EXISTS vote_restrictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT NOT NULL UNIQUE,
        male_voted_user_id TEXT,
        female_voted_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (male_voted_user_id) REFERENCES users(id),
        FOREIGN KEY (female_voted_user_id) REFERENCES users(id)
      )
    `;
    
    // Create basic indexes
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_voter_id ON votes(voter_id)',
      'CREATE INDEX IF NOT EXISTS idx_target_user_id ON votes(target_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_vote_restrictions_voter_id ON vote_restrictions(voter_id)'
    ];
    
    db.serialize(() => {
      // Create tables
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          return reject(err);
        }
        console.log('Users table created/verified');
      });
      
      db.run(createVotesTable, (err) => {
        if (err) {
          console.error('Error creating votes table:', err);
          return reject(err);
        }
        console.log('Votes table created/verified');
      });
      
      db.run(createVoteRestrictionsTable, (err) => {
        if (err) {
          console.error('Error creating vote_restrictions table:', err);
          return reject(err);
        }
        console.log('Vote restrictions table created/verified');
      });
      
      // Create indexes
      createIndexes.forEach((indexSQL, i) => {
        db.run(indexSQL, (err) => {
          if (err) {
            console.error(`Error creating index ${i + 1}:`, err);
            return reject(err);
          }
          console.log(`Index ${i + 1} created/verified`);
        });
      });
      
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          return reject(err);
        }
        console.log('Database initialization completed');
        
        // Run migration after database is closed
        runMigrations()
          .then(() => resolve())
          .catch(reject);
      });
    });
  });
}

// Run database migrations
async function runMigrations() {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    
    // Check if numeric_id column exists
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        console.error('Error getting table columns:', err);
        db.close();
        return reject(err);
      }
      
      const hasNumericId = columns.some(col => col.name === 'numeric_id');
      
      if (!hasNumericId) {
        console.log('Running migration: Adding numeric_id column');
        
        db.serialize(() => {
          // Add numeric_id column
          db.run("ALTER TABLE users ADD COLUMN numeric_id TEXT", (err) => {
            if (err) {
              console.error('Error adding numeric_id column:', err);
              db.close();
              return reject(err);
            }
            console.log('Added numeric_id column to users table');
          });
          
          // Create unique index for numeric_id
          db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_numeric_id ON users(numeric_id)', (err) => {
            if (err) {
              console.error('Error creating numeric_id index:', err);
              db.close();
              return reject(err);
            }
            console.log('Created unique index for numeric_id');
            
            db.close((err) => {
              if (err) {
                console.error('Error closing migration database:', err);
                return reject(err);
              }
              console.log('Migration completed successfully');
              resolve();
            });
          });
        });
      } else {
        console.log('Migration: numeric_id column already exists');
        db.close();
        resolve();
      }
    });
  });
}

// Get database connection (for use in other modules)
function getDatabase() {
  return createConnection();
}

module.exports = {
  initializeDatabase,
  runMigrations,
  getDatabase,
  DB_PATH
};