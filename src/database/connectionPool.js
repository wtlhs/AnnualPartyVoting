const sqlite3 = require('sqlite3');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, '../../data/voting.db');

/**
 * Simple SQLite Connection Pool
 * Manages a pool of database connections for better concurrent performance
 */
class ConnectionPool {
  constructor(options = {}) {
    this.minConnections = options.minConnections || 2;
    this.maxConnections = options.maxConnections || 10;
    this.connectionTimeout = options.connectionTimeout || 30000; // 30 seconds
    this.idleTimeout = options.idleTimeout || 60000; // 60 seconds

    this.availableConnections = [];
    this.activeConnections = new Set();
    this.connectionCount = 0;
    this.isInitialized = false;

    // Track when connections were created for idle cleanup
    this.connectionTimestamps = new WeakMap();
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Create minimum connections
      let created = 0;
      let errors = 0;

      const createMinConnections = () => {
        if (created >= this.minConnections) {
          if (errors > 0) {
            console.warn(`ConnectionPool: Created ${created} of ${this.minConnections} min connections`);
          } else {
            console.log(`ConnectionPool: Initialized with ${this.minConnections} connections (max: ${this.maxConnections})`);
          }
          this.isInitialized = true;
          this.startIdleCleanup();
          return resolve();
        }

        this._createConnection()
          .then((db) => {
            this.availableConnections.push(db);
            created++;
            createMinConnections();
          })
          .catch((err) => {
            errors++;
            console.error('ConnectionPool: Error creating connection:', err.message);
            createMinConnections();
          });
      };

      createMinConnections();
    });
  }

  /**
   * Create a new database connection with WAL mode enabled
   * @private
   */
  _createConnection() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          return reject(err);
        }

        // Configure the connection for optimal performance using PRAGMA
        db.run('PRAGMA busy_timeout=' + this.connectionTimeout);
        db.run('PRAGMA journal_mode=WAL', (err) => {
          if (err) console.warn('ConnectionPool: Failed to set WAL mode:', err.message);
        });
        db.run('PRAGMA foreign_keys=ON');
        db.run('PRAGMA synchronous=NORMAL');
        db.run('PRAGMA cache_size=-64000');

        this.connectionTimestamps.set(db, Date.now());

        resolve(db);
      });
    });
  }

  /**
   * Get a connection from the pool
   * @returns {Promise<sqlite3.Database>}
   */
  async getConnection() {
    // Wait for initialization if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get an available connection
    if (this.availableConnections.length > 0) {
      const db = this.availableConnections.pop();
      this.activeConnections.add(db);
      this.connectionTimestamps.set(db, Date.now()); // Update timestamp
      return db;
    }

    // No available connections, create a new one if under max
    if (this.connectionCount < this.maxConnections) {
      try {
        const db = await this._createConnection();
        this.connectionCount++;
        this.activeConnections.add(db);
        return db;
      } catch (err) {
        console.error('ConnectionPool: Failed to create new connection:', err);
        throw err;
      }
    }

    // Pool is full, wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ConnectionPool: Timeout waiting for available connection'));
      }, this.connectionTimeout);

      // Poll for available connection
      const checkInterval = setInterval(() => {
        if (this.availableConnections.length > 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          const db = this.availableConnections.pop();
          this.activeConnections.add(db);
          this.connectionTimestamps.set(db, Date.now());
          resolve(db);
        }
      }, 100);
    });
  }

  /**
   * Return a connection to the pool
   * @param {sqlite3.Database} db
   */
  releaseConnection(db) {
    if (!db) return;

    if (this.activeConnections.has(db)) {
      this.activeConnections.delete(db);
      this.connectionTimestamps.set(db, Date.now());
      this.availableConnections.push(db);
    }
  }

  /**
   * Close a connection (removes it from the pool)
   * @param {sqlite3.Database} db
   */
  async closeConnection(db) {
    if (!db) return;

    // Remove from available connections
    const availableIndex = this.availableConnections.indexOf(db);
    if (availableIndex > -1) {
      this.availableConnections.splice(availableIndex, 1);
    }

    // Remove from active connections
    this.activeConnections.delete(db);

    // Close the database
    return new Promise((resolve) => {
      db.close(() => {
        this.connectionCount--;
        resolve();
      });
    });
  }

  /**
   * Close all connections in the pool
   */
  async closeAll() {
    this.stopIdleCleanup();

    const closePromises = [
      ...this.availableConnections,
      ...Array.from(this.activeConnections)
    ].map(db => {
      return new Promise(resolve => db.close(resolve));
    });

    await Promise.all(closePromises);

    this.availableConnections = [];
    this.activeConnections.clear();
    this.connectionCount = 0;
    this.isInitialized = false;

    console.log('ConnectionPool: All connections closed');
  }

  /**
   * Start periodic cleanup of idle connections
   * @private
   */
  startIdleCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupIdleConnections();
    }, this.idleTimeout / 2); // Check twice per idle timeout period
  }

  /**
   * Stop idle cleanup
   * @private
   */
  stopIdleCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove idle connections above minimum pool size
   * @private
   */
  _cleanupIdleConnections() {
    const now = Date.now();
    const minToKeep = Math.min(this.availableConnections.length, this.minConnections);

    // Sort available connections by last used time
    const sortedConnections = this.availableConnections.slice().sort((a, b) => {
      const timeA = this.connectionTimestamps.get(a) || 0;
      const timeB = this.connectionTimestamps.get(b) || 0;
      return timeA - timeB;
    });

    // Close connections that are idle and above minimum pool size
    let closedCount = 0;
    for (let i = minToKeep; i < sortedConnections.length; i++) {
      const db = sortedConnections[i];
      const lastUsed = this.connectionTimestamps.get(db) || 0;

      if (now - lastUsed > this.idleTimeout) {
        const index = this.availableConnections.indexOf(db);
        if (index > -1) {
          this.availableConnections.splice(index, 1);
          db.close(() => {
            this.connectionCount--;
            closedCount++;
          });
        }
      }
    }

    if (closedCount > 0) {
      console.log(`ConnectionPool: Closed ${closedCount} idle connections (active: ${this.activeConnections.size}, available: ${this.availableConnections.length})`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.connectionCount,
      activeConnections: this.activeConnections.size,
      availableConnections: this.availableConnections.length,
      isInitialized: this.isInitialized,
      minConnections: this.minConnections,
      maxConnections: this.maxConnections
    };
  }
}

// Create singleton instance
// Connection pool settings for optimal SQLite performance
// SQLite works best with fewer connections despite WAL mode
const pool = new ConnectionPool({
  minConnections: 2,
  maxConnections: 10,
  connectionTimeout: 30000,
  idleTimeout: 60000
});

module.exports = pool;
