/**
 * Migration 007: Add device tracking fields for persistent login
 *
 * This migration adds fields to track user devices and enable auto-login
 * even when browser storage is cleared (common in WeChat and other browsers).
 *
 * Fields added:
 * - device_fingerprint: Unique identifier for user device (based on User-Agent + IP pattern)
 * - last_login_time: Track last login time for session validation
 * - last_login_ip: Track last login IP for security
 */

module.exports = {
    id: 7,
    filename: '007-add-device-tracking.js',
    description: 'Add device tracking fields for persistent login',

    /**
     * Apply the migration
     * @param {import('better-sqlite3').Database} db - Database instance
     */
    async up() {
        const { getDatabase, releaseConnection } = require('../init');
        const db = await getDatabase();

        console.log('Applying migration 007: Adding device tracking fields...');

        // Helper function to check if column exists
        const columnExists = (columnName) => {
            return new Promise(async (resolve, reject) => {
                db.all("PRAGMA table_info(users)", (err, columns) => {
                    if (err) return reject(err);
                    resolve(columns.some(col => col.name === columnName));
                });
            });
        };

        // Helper function to execute SQL
        const execSQL = (sql) => {
            return new Promise(async (resolve, reject) => {
                db.exec(sql, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        };

        // Check if device_fingerprint column already exists
        const hasDeviceFingerprint = await columnExists('device_fingerprint');

        if (!hasDeviceFingerprint) {
            // Add device tracking columns to users table
            await execSQL(`
                ALTER TABLE users ADD COLUMN device_fingerprint TEXT;
            `);
            await execSQL(`
                CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
            `);
            console.log('  ✓ Added device_fingerprint column');
        } else {
            console.log('  ⊘ device_fingerprint column already exists');
        }

        // Check if last_login_time column already exists
        const hasLastLoginTime = await columnExists('last_login_time');

        if (!hasLastLoginTime) {
            await execSQL(`
                ALTER TABLE users ADD COLUMN last_login_time INTEGER;
            `);
            console.log('  ✓ Added last_login_time column');
        } else {
            console.log('  ⊘ last_login_time column already exists');
        }

        // Check if last_login_ip column already exists
        const hasLastLoginIp = await columnExists('last_login_ip');

        if (!hasLastLoginIp) {
            await execSQL(`
                ALTER TABLE users ADD COLUMN last_login_ip TEXT;
            `);
            console.log('  ✓ Added last_login_ip column');
        } else {
            console.log('  ⊘ last_login_ip column already exists');
        }

        releaseConnection(db);
        console.log('✓ Migration 007 completed successfully');
    }
};
