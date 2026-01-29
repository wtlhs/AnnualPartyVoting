/**
 * Unit tests for validation utilities
 * Tests specific examples and edge cases for validation functions
 */

import {
  validateCandidateId,
  validateCandidateName,
  validateCategory,
  validateSource,
  validateTimestamp,
  validateVotePageParams,
  validateCandidateInfo,
  sanitizeInput,
  encodeURLParams,
  decodeURLParams,
  generateTimestamp,
  isFromTrustedDomain,
  createValidationError,
  hasValidationError,
  combineValidationResults,
} from './validation';

import { ERROR_MESSAGES } from '../types/qr-code-voting';
import { testData } from '../test-setup';

describe('Validation Utilities', () => {
  describe('validateCandidateId', () => {
    test('should accept valid candidate IDs', () => {
      expect(validateCandidateId('candidate-123')).toBe(true);
      expect(validateCandidateId('user_456')).toBe(true);
      expect(validateCandidateId('ABC123')).toBe(true);
      expect(validateCandidateId('test-user-1')).toBe(true);
    });

    test('should reject invalid candidate IDs', () => {
      expect(validateCandidateId('')).toBe(false);
      expect(validateCandidateId('candidate 123')).toBe(false); // Space not allowed
      expect(validateCandidateId('candidate@123')).toBe(false); // @ not allowed
      expect(validateCandidateId('candidate.123')).toBe(false); // . not allowed
      expect(validateCandidateId(null as any)).toBe(false);
      expect(validateCandidateId(undefined as any)).toBe(false);
    });
  });

  describe('validateCandidateName', () => {
    test('should accept valid candidate names', () => {
      expect(validateCandidateName('张三')).toBe(true);
      expect(validateCandidateName('John Doe')).toBe(true);
      expect(validateCandidateName('李四-Wang')).toBe(true);
      expect(validateCandidateName('Test User (IT)')).toBe(true);
      expect(validateCandidateName('User_123')).toBe(true);
    });

    test('should reject invalid candidate names', () => {
      expect(validateCandidateName('')).toBe(false);
      expect(validateCandidateName('   ')).toBe(false); // Only whitespace
      expect(validateCandidateName('a'.repeat(51))).toBe(false); // Too long
      expect(validateCandidateName('User<script>')).toBe(false); // Invalid characters
      expect(validateCandidateName('User"test')).toBe(false); // Quote not allowed
      expect(validateCandidateName(null as any)).toBe(false);
    });
  });

  describe('validateCategory', () => {
    test('should accept valid categories', () => {
      expect(validateCategory('最佳员工')).toBe(true);
      expect(validateCategory('Best Employee')).toBe(true);
      expect(validateCategory('Team-Lead_2023')).toBe(true);
      expect(validateCategory(undefined)).toBe(true); // Optional field
    });

    test('should reject invalid categories', () => {
      expect(validateCategory('Category<script>')).toBe(false);
      expect(validateCategory('Cat"egory')).toBe(false);
      expect(validateCategory(null as any)).toBe(false);
    });
  });

  describe('validateSource', () => {
    test('should accept valid sources', () => {
      expect(validateSource('qrcode')).toBe(true);
      expect(validateSource('direct')).toBe(true);
    });

    test('should reject invalid sources', () => {
      expect(validateSource('invalid')).toBe(false);
      expect(validateSource('QRCode')).toBe(false); // Case sensitive
      expect(validateSource('')).toBe(false);
      expect(validateSource('qr code')).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    test('should accept valid timestamps', () => {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;
      
      expect(validateTimestamp(now.toString())).toBe(true);
      expect(validateTimestamp(oneHourAgo.toString())).toBe(true);
      expect(validateTimestamp(undefined)).toBe(true); // Optional
    });

    test('should reject expired timestamps', () => {
      const now = Math.floor(Date.now() / 1000);
      const twoDaysAgo = now - (2 * 24 * 3600);
      
      expect(validateTimestamp(twoDaysAgo.toString())).toBe(false);
      expect(validateTimestamp('invalid')).toBe(false);
      expect(validateTimestamp('0')).toBe(false);
    });
  });

  describe('validateVotePageParams', () => {
    test('should accept valid vote page parameters', () => {
      const result = validateVotePageParams(testData.validVoteParams);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedParams).toBeDefined();
    });

    test('should reject invalid vote page parameters', () => {
      const invalidParams = {
        candidateId: '', // Invalid
        candidateName: 'Valid Name',
        source: 'qrcode'
      };
      
      const result = validateVotePageParams(invalidParams);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    });

    test('should handle missing required parameters', () => {
      const result = validateVotePageParams({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.MISSING_REQUIRED_PARAM);
    });
  });

  describe('validateCandidateInfo', () => {
    test('should accept valid candidate info', () => {
      const result = validateCandidateInfo(testData.validCandidate);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid candidate info', () => {
      const invalidCandidate = {
        id: '', // Invalid
        name: 'Valid Name'
      };
      
      const result = validateCandidateInfo(invalidCandidate);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    });
  });

  describe('sanitizeInput', () => {
    test('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
      expect(sanitizeInput('  spaced  ')).toBe('spaced');
    });

    test('should handle non-string input', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });

    test('should limit length', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeInput(longString);
      expect(result.length).toBe(1000);
    });
  });

  describe('encodeURLParams and decodeURLParams', () => {
    test('should encode and decode URL parameters correctly', () => {
      const params = {
        candidate_id: 'test-123',
        candidate_name: '张三 李四',
        category: 'Best Employee (2023)'
      };
      
      const encoded = encodeURLParams(params);
      const decoded = decodeURLParams(encoded);
      
      expect(decoded.candidate_id).toBe(params.candidate_id);
      expect(decoded.candidate_name).toBe(params.candidate_name);
      expect(decoded.category).toBe(params.category);
    });

    test('should handle empty parameters', () => {
      expect(encodeURLParams({})).toBe('');
      expect(decodeURLParams('')).toEqual({});
    });

    test('should handle invalid encoded parameters gracefully', () => {
      const result = decodeURLParams('invalid%param=value');
      // Should not crash and should skip invalid parameters
      expect(typeof result).toBe('object');
    });
  });

  describe('generateTimestamp', () => {
    test('should generate valid timestamp string', () => {
      const timestamp = generateTimestamp();
      expect(typeof timestamp).toBe('string');
      expect(parseInt(timestamp, 10)).toBeGreaterThan(0);
      expect(validateTimestamp(timestamp)).toBe(true);
    });
  });

  describe('isFromTrustedDomain', () => {
    const trustedDomains = ['example.com', 'trusted.org'];

    test('should accept URLs from trusted domains', () => {
      expect(isFromTrustedDomain('https://example.com/path', trustedDomains)).toBe(true);
      expect(isFromTrustedDomain('https://sub.example.com/path', trustedDomains)).toBe(true);
      expect(isFromTrustedDomain('https://trusted.org', trustedDomains)).toBe(true);
    });

    test('should reject URLs from untrusted domains', () => {
      expect(isFromTrustedDomain('https://evil.com/path', trustedDomains)).toBe(false);
      expect(isFromTrustedDomain('https://notexample.com/path', trustedDomains)).toBe(false);
    });

    test('should handle invalid URLs', () => {
      expect(isFromTrustedDomain('not-a-url', trustedDomains)).toBe(false);
      expect(isFromTrustedDomain('', trustedDomains)).toBe(false);
    });
  });

  describe('validation error helpers', () => {
    test('createValidationError should format error correctly', () => {
      const error = createValidationError('candidateId', 'Invalid format');
      expect(error).toBe('candidateId: Invalid format');
    });

    test('hasValidationError should detect specific errors', () => {
      const result = { isValid: false, errors: [ERROR_MESSAGES.INVALID_CANDIDATE_ID] };
      expect(hasValidationError(result, ERROR_MESSAGES.INVALID_CANDIDATE_ID)).toBe(true);
      expect(hasValidationError(result, ERROR_MESSAGES.INVALID_CANDIDATE_NAME)).toBe(false);
    });

    test('combineValidationResults should merge results correctly', () => {
      const result1 = { isValid: true, errors: [] };
      const result2 = { isValid: false, errors: ['Error 1'] };
      const result3 = { isValid: false, errors: ['Error 2'] };
      
      const combined = combineValidationResults([result1, result2, result3]);
      expect(combined.isValid).toBe(false);
      expect(combined.errors).toEqual(['Error 1', 'Error 2']);
    });
  });
});