/**
 * Device Fingerprint Utility
 *
 * Generates unique device fingerprints based on User-Agent and IP patterns
 * to enable auto-login even when browser storage is cleared.
 */

const crypto = require('crypto');

/**
 * Generate a device fingerprint from request headers and IP
 * @param {Object} req - Express request object
 * @returns {string} - Device fingerprint hash
 */
function generateDeviceFingerprint(req) {
    // Extract device identifiers
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Get IP address (handle proxy scenarios)
    const ip = getClientIP(req);

    // Create a normalized fingerprint string
    const fingerprintData = `${userAgent}|${acceptLanguage}|${ip}`;

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

/**
 * Extract client IP from request, handling proxies
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
    // Check various headers for IP (reverse order of priority)
    return req.ip ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.connection?.socket?.remoteAddress ||
           'unknown';
}

/**
 * Generate a simple device fingerprint (less reliable but faster)
 * Based only on User-Agent
 * @param {Object} req - Express request object
 * @returns {string} - Simple device fingerprint hash
 */
function generateSimpleDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    return crypto.createHash('md5').update(userAgent).digest('hex');
}

/**
 * Check if two fingerprints match (with tolerance for minor changes)
 * @param {string} fp1 - First fingerprint
 * @param {string} fp2 - Second fingerprint
 * @returns {boolean} - True if fingerprints match
 */
function fingerprintsMatch(fp1, fp2) {
    if (!fp1 || !fp2) return false;
    return fp1 === fp2;
}

module.exports = {
    generateDeviceFingerprint,
    generateSimpleDeviceFingerprint,
    getClientIP,
    fingerprintsMatch
};
