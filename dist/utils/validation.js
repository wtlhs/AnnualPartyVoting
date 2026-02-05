"use strict";
/**
 * Validation utilities for QR Code Voting URL feature
 * Implements security and data validation rules from design document
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCandidateId = validateCandidateId;
exports.validateCandidateName = validateCandidateName;
exports.validateCategory = validateCategory;
exports.validateSource = validateSource;
exports.validateTimestamp = validateTimestamp;
exports.validateVotePageParams = validateVotePageParams;
exports.validateCandidateInfo = validateCandidateInfo;
exports.sanitizeInput = sanitizeInput;
exports.encodeURLParams = encodeURLParams;
exports.decodeURLParams = decodeURLParams;
exports.generateTimestamp = generateTimestamp;
exports.isFromTrustedDomain = isFromTrustedDomain;
exports.createValidationError = createValidationError;
exports.hasValidationError = hasValidationError;
exports.combineValidationResults = combineValidationResults;
const qr_code_voting_1 = require("../types/qr-code-voting");
// ============================================================================
// URL Parameter Validation
// ============================================================================
/**
 * Validate candidate ID format and security
 * @param candidateId - Candidate ID to validate
 * @returns Whether candidate ID is valid
 */
function validateCandidateId(candidateId) {
    if (!candidateId || typeof candidateId !== 'string') {
        return false;
    }
    return qr_code_voting_1.SECURITY_PATTERNS.CANDIDATE_ID_PATTERN.test(candidateId);
}
/**
 * Validate candidate name format and length
 * @param candidateName - Candidate name to validate
 * @returns Whether candidate name is valid
 */
function validateCandidateName(candidateName) {
    if (!candidateName || typeof candidateName !== 'string') {
        return false;
    }
    const length = candidateName.trim().length;
    if (length < qr_code_voting_1.URL_VALIDATION_RULES.MIN_CANDIDATE_NAME_LENGTH ||
        length > qr_code_voting_1.URL_VALIDATION_RULES.MAX_CANDIDATE_NAME_LENGTH) {
        return false;
    }
    return qr_code_voting_1.SECURITY_PATTERNS.CANDIDATE_NAME_PATTERN.test(candidateName);
}
/**
 * Validate category format if provided
 * @param category - Category to validate
 * @returns Whether category is valid
 */
function validateCategory(category) {
    if (!category || category === null || category === undefined) {
        return category === undefined; // Only undefined is valid for optional field
    }
    if (typeof category !== 'string') {
        return false;
    }
    return qr_code_voting_1.SECURITY_PATTERNS.CATEGORY_PATTERN.test(category);
}
/**
 * Validate source parameter
 * @param source - Source to validate
 * @returns Whether source is valid
 */
function validateSource(source) {
    return qr_code_voting_1.URL_VALIDATION_RULES.VALID_SOURCES.includes(source);
}
/**
 * Validate timestamp parameter
 * @param timestamp - Timestamp string to validate
 * @returns Whether timestamp is valid and not expired
 */
function validateTimestamp(timestamp) {
    if (!timestamp) {
        return true; // Timestamp is optional
    }
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
        return false;
    }
    const now = Date.now();
    const timestampMs = timestampNum * 1000; // Convert to milliseconds
    const maxAge = qr_code_voting_1.URL_VALIDATION_RULES.MAX_TIMESTAMP_AGE_HOURS * 60 * 60 * 1000;
    return (now - timestampMs) <= maxAge;
}
// ============================================================================
// Comprehensive Parameter Validation
// ============================================================================
/**
 * Validate complete vote page parameters
 * @param params - Parameters to validate
 * @returns Validation result with errors and sanitized params
 */
function validateVotePageParams(params) {
    const errors = [];
    // Type check first
    if (!(0, qr_code_voting_1.isVotePageParams)(params)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.MISSING_REQUIRED_PARAM);
        return { isValid: false, errors };
    }
    // Validate individual fields
    if (!validateCandidateId(params.candidateId)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    }
    if (!validateCandidateName(params.candidateName)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.INVALID_CANDIDATE_NAME);
    }
    if (!validateSource(params.source)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.INVALID_SOURCE);
    }
    if (!validateCategory(params.category)) {
        errors.push('Invalid category format');
    }
    if (!validateTimestamp(params.timestamp)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.EXPIRED_TIMESTAMP);
    }
    if (errors.length > 0) {
        return { isValid: false, errors };
    }
    // Sanitize parameters
    const sanitizedParams = {
        candidateId: params.candidateId.trim(),
        candidateName: params.candidateName.trim(),
        source: params.source,
        category: params.category?.trim(),
        timestamp: params.timestamp,
    };
    return {
        isValid: true,
        errors: [],
        sanitizedParams,
    };
}
/**
 * Validate candidate information
 * @param candidateInfo - Candidate info to validate
 * @returns Validation result
 */
function validateCandidateInfo(candidateInfo) {
    const errors = [];
    if (!(0, qr_code_voting_1.isCandidateInfo)(candidateInfo)) {
        errors.push('Invalid candidate information structure');
        return { isValid: false, errors };
    }
    if (!validateCandidateId(candidateInfo.id)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    }
    if (!validateCandidateName(candidateInfo.name)) {
        errors.push(qr_code_voting_1.ERROR_MESSAGES.INVALID_CANDIDATE_NAME);
    }
    if (!validateCategory(candidateInfo.category)) {
        errors.push('Invalid category format');
    }
    if (errors.length > 0) {
        return { isValid: false, errors };
    }
    return { isValid: true, errors: [] };
}
// ============================================================================
// Security Utilities
// ============================================================================
/**
 * Sanitize string input to prevent injection attacks
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .trim()
        .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
        .substring(0, 1000); // Limit length
}
/**
 * Encode URL parameters safely
 * @param params - Parameters to encode
 * @returns Encoded parameter string
 */
function encodeURLParams(params) {
    const encodedParams = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    return encodedParams;
}
/**
 * Decode URL parameters safely
 * @param paramString - Parameter string to decode
 * @returns Decoded parameters object
 */
function decodeURLParams(paramString) {
    const params = {};
    if (!paramString) {
        return params;
    }
    const pairs = paramString.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
            try {
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
            catch (error) {
                // Skip invalid encoded parameters
                console.warn('Failed to decode URL parameter:', pair);
            }
        }
    }
    return params;
}
/**
 * Generate secure timestamp for URL validation
 * @returns Unix timestamp as string
 */
function generateTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
}
/**
 * Check if URL is from a trusted domain (for security)
 * @param url - URL to check
 * @param trustedDomains - List of trusted domains
 * @returns Whether URL is from trusted domain
 */
function isFromTrustedDomain(url, trustedDomains) {
    try {
        const urlObj = new URL(url);
        return trustedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`));
    }
    catch {
        return false;
    }
}
// ============================================================================
// Validation Error Helpers
// ============================================================================
/**
 * Create standardized validation error
 * @param field - Field that failed validation
 * @param message - Error message
 * @returns Formatted error message
 */
function createValidationError(field, message) {
    return `${field}: ${message}`;
}
/**
 * Check if validation result has specific error
 * @param result - Validation result
 * @param errorMessage - Error message to check for
 * @returns Whether error exists
 */
function hasValidationError(result, errorMessage) {
    return result.errors.includes(errorMessage);
}
/**
 * Combine multiple validation results
 * @param results - Array of validation results
 * @returns Combined validation result
 */
function combineValidationResults(results) {
    const allErrors = results.flatMap(result => result.errors);
    const isValid = results.every(result => result.isValid);
    return {
        isValid,
        errors: allErrors,
    };
}
//# sourceMappingURL=validation.js.map