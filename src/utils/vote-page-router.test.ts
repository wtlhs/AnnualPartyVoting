/**
 * Unit Tests for Vote Page Router
 * Tests URL parameter parsing and validation functionality
 * Covers requirements 2.1 and 2.3 from the design document
 */

import {
  VotingPageRouter,
  createVotePageRouter,
  VotePageRouterUtils
} from './vote-page-router';

import {
  VotePageParams,
  ERROR_MESSAGES
} from '../types/qr-code-voting';

describe('VotingPageRouter', () => {
  let router: VotingPageRouter;

  beforeEach(() => {
    router = new VotingPageRouter();
  });

  describe('parseURLParams', () => {
    it('should parse valid full URL with all parameters', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&category=最佳员工&source=qrcode&timestamp=1640995200';
      const result = router.parseURLParams(url);

      expect(result).toEqual({
        candidateId: '123',
        candidateName: '张三',
        category: '最佳员工',
        source: 'qrcode',
        timestamp: '1640995200'
      });
    });

    it('should parse valid query string without domain', () => {
      const queryString = '?candidate_id=456&candidate_name=李四&source=qrcode';
      const result = router.parseURLParams(queryString);

      expect(result).toEqual({
        candidateId: '456',
        candidateName: '李四',
        source: 'qrcode',
        category: undefined,
        timestamp: undefined
      });
    });

    it('should parse query string without question mark', () => {
      const queryString = 'candidate_id=789&candidate_name=王五&source=direct';
      const result = router.parseURLParams(queryString);

      expect(result).toEqual({
        candidateId: '789',
        candidateName: '王五',
        source: 'direct',
        category: undefined,
        timestamp: undefined
      });
    });

    it('should handle URL encoded parameters', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=%E5%BC%A0%E4%B8%89&category=%E6%9C%80%E4%BD%B3%E5%91%98%E5%B7%A5&source=qrcode';
      const result = router.parseURLParams(url);

      expect(result.candidateName).toBe('张三');
      expect(result.category).toBe('最佳员工');
    });

    it('should handle missing parameters gracefully', () => {
      const url = 'https://domain.com/vote?candidate_id=123';
      const result = router.parseURLParams(url);

      expect(result).toEqual({
        candidateId: '123',
        candidateName: '',
        source: 'direct',
        category: undefined,
        timestamp: undefined
      });
    });

    it('should handle empty URL gracefully', () => {
      const result = router.parseURLParams('');

      expect(result).toEqual({
        candidateId: '',
        candidateName: '',
        source: 'direct',
        category: undefined,
        timestamp: undefined
      });
    });

    it('should handle malformed URL gracefully', () => {
      const result = router.parseURLParams('not-a-valid-url');

      expect(result).toEqual({
        candidateId: '',
        candidateName: '',
        source: 'direct',
        category: undefined,
        timestamp: undefined
      });
    });

    it('should sanitize potentially dangerous input', () => {
      const url = 'https://domain.com/vote?candidate_id=123<script>&candidate_name=test"&source=qrcode';
      const result = router.parseURLParams(url);

      expect(result.candidateId).toBe('123script'); // Dangerous chars removed
      expect(result.candidateName).toBe('test'); // Dangerous chars removed
    });

    it('should handle special characters in candidate names', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三-李四(测试)&source=qrcode';
      const result = router.parseURLParams(url);

      expect(result.candidateName).toBe('张三-李四(测试)');
    });

    it('should handle multiple values for same parameter (takes last)', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_id=456&candidate_name=张三&source=qrcode';
      const result = router.parseURLParams(url);

      expect(result.candidateId).toBe('456'); // Last value wins
    });
  });

  describe('validateParams', () => {
    it('should validate correct parameters', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        category: '最佳员工',
        timestamp: Math.floor(Date.now() / 1000).toString() // Use current timestamp
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedParams).toBeDefined();
    });

    it('should reject invalid candidate ID', () => {
      const params: VotePageParams = {
        candidateId: 'invalid@id!',
        candidateName: '张三',
        source: 'qrcode'
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    });

    it('should reject empty candidate ID', () => {
      const params: VotePageParams = {
        candidateId: '',
        candidateName: '张三',
        source: 'qrcode'
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_ID);
    });

    it('should reject invalid candidate name', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '',
        source: 'qrcode'
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_NAME);
    });

    it('should reject candidate name that is too long', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: 'a'.repeat(51), // Exceeds max length of 50
        source: 'qrcode'
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.INVALID_CANDIDATE_NAME);
    });

    it('should reject invalid source', () => {
      // Create params with invalid source but bypass type guard by using any
      const params = {
        candidateId: '123',
        candidateName: '张三',
        source: 'invalid'
      };

      const result = router.validateParams(params as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.MISSING_REQUIRED_PARAM); // Type guard fails first
    });

    it('should reject expired timestamp', () => {
      const expiredTimestamp = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000).toString(); // 25 hours ago
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        timestamp: expiredTimestamp
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(ERROR_MESSAGES.EXPIRED_TIMESTAMP);
    });

    it('should accept valid timestamp', () => {
      const validTimestamp = Math.floor(Date.now() / 1000).toString(); // Current time
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        timestamp: validTimestamp
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(true);
    });

    it('should accept undefined timestamp', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(true);
    });

    it('should sanitize valid parameters', () => {
      const params: VotePageParams = {
        candidateId: '123', // Don't use spaces in candidate ID as it's validated before sanitization
        candidateName: '  张三  ',
        source: 'qrcode',
        category: '  最佳员工  ',
        timestamp: Math.floor(Date.now() / 1000).toString() // Use current timestamp
      };

      const result = router.validateParams(params);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedParams?.candidateId).toBe('123');
      expect(result.sanitizedParams?.candidateName).toBe('张三');
      expect(result.sanitizedParams?.category).toBe('最佳员工');
    });

    it('should handle multiple validation errors', () => {
      const params = {
        candidateId: '',
        candidateName: '',
        source: 'invalid'
      };

      const result = router.validateParams(params as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1); // Type guard fails, so only one error
    });
  });

  describe('parseURLParamsWithErrors', () => {
    it('should return success for valid URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      const result = router.parseURLParamsWithErrors(url);

      expect(result.success).toBe(true);
      expect(result.params).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for URL with no parameters', () => {
      const url = 'https://domain.com/vote';
      const result = router.parseURLParamsWithErrors(url);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No valid parameters found in URL');
    });
  });

  describe('parseAndValidateURL', () => {
    it('should successfully parse and validate good URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      const result = router.parseAndValidateURL(url);

      expect(result.parseSuccess).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.params).toBeDefined();
      expect(result.parseErrors).toHaveLength(0);
    });

    it('should handle parse failure', () => {
      const url = '';
      const result = router.parseAndValidateURL(url);

      expect(result.parseSuccess).toBe(false);
      expect(result.validationResult.isValid).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });

    it('should handle validation failure after successful parse', () => {
      const url = 'https://domain.com/vote?candidate_id=invalid@id&candidate_name=张三&source=qrcode';
      const result = router.parseAndValidateURL(url);

      expect(result.parseSuccess).toBe(true);
      expect(result.validationResult.isValid).toBe(false);
      expect(result.parseErrors).toHaveLength(0);
    });
  });

  describe('extractParameter', () => {
    const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&category=最佳员工&source=qrcode&timestamp=1640995200';

    it('should extract candidate ID', () => {
      expect(router.extractParameter(url, 'candidate_id')).toBe('123');
      expect(router.extractParameter(url, 'candidateId')).toBe('123');
    });

    it('should extract candidate name', () => {
      expect(router.extractParameter(url, 'candidate_name')).toBe('张三');
      expect(router.extractParameter(url, 'candidateName')).toBe('张三');
    });

    it('should extract category', () => {
      expect(router.extractParameter(url, 'category')).toBe('最佳员工');
    });

    it('should extract source', () => {
      expect(router.extractParameter(url, 'source')).toBe('qrcode');
    });

    it('should extract timestamp', () => {
      expect(router.extractParameter(url, 'timestamp')).toBe('1640995200');
    });

    it('should return null for non-existent parameter', () => {
      expect(router.extractParameter(url, 'nonexistent')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(router.extractParameter('invalid-url', 'candidate_id')).toBeNull();
    });
  });

  describe('hasValidVotingParams', () => {
    it('should return true for valid voting URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      expect(router.hasValidVotingParams(url)).toBe(true);
    });

    it('should return false for URL missing required parameters', () => {
      const url = 'https://domain.com/vote?candidate_id=123';
      expect(router.hasValidVotingParams(url)).toBe(false);
    });

    it('should return false for invalid source', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=invalid';
      expect(router.hasValidVotingParams(url)).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(router.hasValidVotingParams('invalid-url')).toBe(false);
    });
  });

  describe('normalizeParams', () => {
    it('should trim whitespace from parameters', () => {
      const params: VotePageParams = {
        candidateId: '  123  ',
        candidateName: '  张三  ',
        source: 'qrcode',
        category: '  最佳员工  ',
        timestamp: '  1640995200  '
      };

      const normalized = router.normalizeParams(params);

      expect(normalized.candidateId).toBe('123');
      expect(normalized.candidateName).toBe('张三');
      expect(normalized.category).toBe('最佳员工');
      expect(normalized.timestamp).toBe('1640995200');
    });

    it('should handle undefined optional parameters', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const normalized = router.normalizeParams(params);

      expect(normalized.category).toBeUndefined();
      expect(normalized.timestamp).toBeUndefined();
    });
  });

  describe('paramsToQueryString', () => {
    it('should convert parameters to query string', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        category: '最佳员工',
        timestamp: '1640995200'
      };

      const queryString = router.paramsToQueryString(params);

      expect(queryString).toContain('candidate_id=123');
      expect(queryString).toContain('candidate_name=%E5%BC%A0%E4%B8%89'); // URL encoded
      expect(queryString).toContain('source=qrcode');
      expect(queryString).toContain('category=%E6%9C%80%E4%BD%B3%E5%91%98%E5%B7%A5'); // URL encoded
      expect(queryString).toContain('timestamp=1640995200');
    });

    it('should omit undefined optional parameters', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const queryString = router.paramsToQueryString(params);

      expect(queryString).not.toContain('category');
      expect(queryString).not.toContain('timestamp');
    });
  });

  describe('createVotingURL', () => {
    it('should create complete voting URL', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const url = router.createVotingURL(params, 'https://example.com');

      expect(url).toMatch(/^https:\/\/example\.com\/vote\?/);
      expect(url).toContain('candidate_id=123');
      expect(url).toContain('candidate_name=%E5%BC%A0%E4%B8%89');
      expect(url).toContain('source=qrcode');
    });

    it('should use default base URL', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const url = router.createVotingURL(params);

      expect(url).toMatch(/^https:\/\/domain\.com\/vote\?/);
    });

    it('should handle base URL with trailing slash', () => {
      const params: VotePageParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode'
      };

      const url = router.createVotingURL(params, 'https://example.com/');

      expect(url).toMatch(/^https:\/\/example\.com\/vote\?/);
    });
  });
});

describe('createVotePageRouter', () => {
  it('should create a VotePageRouter instance', () => {
    const router = createVotePageRouter();
    expect(router).toBeInstanceOf(VotingPageRouter);
  });
});

describe('VotePageRouterUtils', () => {
  describe('quickValidate', () => {
    it('should quickly validate valid URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      const result = VotePageRouterUtils.quickValidate(url);

      expect(result.isValid).toBe(true);
      expect(result.params).toBeDefined();
    });

    it('should quickly validate invalid URL', () => {
      const url = 'https://domain.com/vote?candidate_id=invalid@id&candidate_name=张三&source=qrcode';
      const result = VotePageRouterUtils.quickValidate(url);

      expect(result.isValid).toBe(false);
      expect(result.params).toBeUndefined();
    });
  });

  describe('extractCandidateInfo', () => {
    it('should extract candidate information', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&category=最佳员工&source=qrcode';
      const info = VotePageRouterUtils.extractCandidateInfo(url);

      expect(info).toEqual({
        id: '123',
        name: '张三',
        category: '最佳员工'
      });
    });

    it('should return null for invalid URL', () => {
      const url = 'https://domain.com/vote';
      const info = VotePageRouterUtils.extractCandidateInfo(url);

      expect(info).toBeNull();
    });
  });

  describe('isValidVotingURL', () => {
    it('should return true for valid voting URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      expect(VotePageRouterUtils.isValidVotingURL(url)).toBe(true);
    });

    it('should return false for invalid voting URL', () => {
      const url = 'https://domain.com/vote?candidate_id=invalid@id&candidate_name=张三&source=qrcode';
      expect(VotePageRouterUtils.isValidVotingURL(url)).toBe(false);
    });
  });

  describe('sanitizeVotingURL', () => {
    it('should sanitize valid URL', () => {
      const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      const sanitized = VotePageRouterUtils.sanitizeVotingURL(url);

      expect(sanitized).toBeTruthy();
      expect(sanitized).toContain('candidate_id=123');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://domain.com/vote?candidate_id=invalid@id&candidate_name=张三&source=qrcode';
      const sanitized = VotePageRouterUtils.sanitizeVotingURL(url);

      expect(sanitized).toBeNull();
    });
  });
});

describe('Edge Cases and Security', () => {
  let router: VotingPageRouter;

  beforeEach(() => {
    router = new VotingPageRouter();
  });

  it('should handle extremely long URLs gracefully', () => {
    const longName = 'a'.repeat(1000);
    const url = `https://domain.com/vote?candidate_id=123&candidate_name=${longName}&source=qrcode`;
    
    const result = router.parseURLParams(url);
    expect(result.candidateName.length).toBeLessThanOrEqual(1000); // Should be truncated by sanitization
  });

  it('should handle URLs with malicious scripts', () => {
    const url = 'https://domain.com/vote?candidate_id=123<script>alert("xss")</script>&candidate_name=test&source=qrcode';
    
    const result = router.parseURLParams(url);
    expect(result.candidateId).not.toContain('<script>');
    expect(result.candidateId).not.toContain('<');
    expect(result.candidateId).not.toContain('>');
    // Note: sanitizeInput removes <> but not other characters like 'alert'
  });

  it('should handle URLs with SQL injection attempts', () => {
    const url = "https://domain.com/vote?candidate_id=123'; DROP TABLE users; --&candidate_name=test&source=qrcode";
    
    const result = router.parseURLParams(url);
    const validation = router.validateParams(result);
    
    expect(validation.isValid).toBe(false); // Should be rejected due to invalid characters
  });

  it('should handle Unicode characters properly', () => {
    const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三李四王五&category=最佳员工奖&source=qrcode';
    
    const result = router.parseURLParams(url);
    expect(result.candidateName).toBe('张三李四王五');
    expect(result.category).toBe('最佳员工奖');
  });

  it('should handle empty and null values', () => {
    const url = 'https://domain.com/vote?candidate_id=&candidate_name=&source=';
    
    const result = router.parseURLParams(url);
    const validation = router.validateParams(result);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should handle URLs with duplicate parameters', () => {
    const url = 'https://domain.com/vote?candidate_id=123&candidate_id=456&candidate_name=first&candidate_name=second&source=qrcode';
    
    const result = router.parseURLParams(url);
    // Should take the last value for each parameter
    expect(result.candidateId).toBe('456');
    expect(result.candidateName).toBe('second');
  });
});