"use strict";
/**
 * Core TypeScript interfaces for QR Code Voting URL feature
 * Based on design document specifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_MESSAGES = exports.SECURITY_PATTERNS = exports.URL_VALIDATION_RULES = void 0;
exports.isCandidateInfo = isCandidateInfo;
exports.isVotePageParams = isVotePageParams;
exports.isUser = isUser;
// ============================================================================
// Validation Rules and Constants
// ============================================================================
/**
 * URL parameter validation rules
 */
exports.URL_VALIDATION_RULES = {
    /** Maximum length for candidate name */
    MAX_CANDIDATE_NAME_LENGTH: 50,
    /** Minimum length for candidate name */
    MIN_CANDIDATE_NAME_LENGTH: 1,
    /** Maximum age for timestamp in hours */
    MAX_TIMESTAMP_AGE_HOURS: 24,
    /** Valid source values */
    VALID_SOURCES: ['qrcode', 'direct'],
    /** Required URL parameters */
    REQUIRED_PARAMS: ['candidate_id', 'candidate_name', 'source'],
};
/**
 * Security validation patterns
 */
exports.SECURITY_PATTERNS = {
    /** Pattern for valid candidate ID (alphanumeric and hyphens) */
    CANDIDATE_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/,
    /** Pattern for valid candidate name (letters, numbers, spaces, basic punctuation) */
    CANDIDATE_NAME_PATTERN: /^[a-zA-Z0-9\s\u4e00-\u9fff\-_.()]+$/,
    /** Pattern for valid category name */
    CATEGORY_PATTERN: /^[a-zA-Z0-9\s\u4e00-\u9fff\-_.()]+$/,
};
/**
 * Error message constants
 */
exports.ERROR_MESSAGES = {
    INVALID_CANDIDATE_ID: 'Invalid candidate ID format',
    INVALID_CANDIDATE_NAME: 'Invalid candidate name format',
    MISSING_REQUIRED_PARAM: 'Missing required parameter',
    EXPIRED_TIMESTAMP: 'URL has expired',
    INVALID_SOURCE: 'Invalid source parameter',
    CANDIDATE_NOT_FOUND: 'Candidate not found',
    AUTHENTICATION_REQUIRED: 'Authentication required',
    VOTING_PERMISSION_DENIED: 'Voting permission denied',
    DUPLICATE_VOTE: 'Vote already exists for this candidate',
    VOTE_SUBMISSION_FAILED: 'Failed to submit vote',
};
// ============================================================================
// Type Guards and Utility Types
// ============================================================================
/**
 * Type guard for CandidateInfo
 */
function isCandidateInfo(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        (obj.category === undefined || typeof obj.category === 'string'));
}
/**
 * Type guard for VotePageParams
 */
function isVotePageParams(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.candidateId === 'string' &&
        typeof obj.candidateName === 'string' &&
        (obj.source === 'qrcode' || obj.source === 'direct') &&
        (obj.category === undefined || typeof obj.category === 'string') &&
        (obj.timestamp === undefined || typeof obj.timestamp === 'string'));
}
/**
 * Type guard for User
 */
function isUser(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'string' &&
        typeof obj.username === 'string' &&
        typeof obj.email === 'string' &&
        typeof obj.hasVotingRights === 'boolean');
}
//# sourceMappingURL=qr-code-voting.js.map