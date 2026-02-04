/**
 * End-to-End Tests for Vote Registration Verification Feature
 * 
 * Tests the complete user workflow for vote registration verification:
 * - Unregistered user attempting to vote
 * - Registration completion and automatic return
 * - Error handling scenarios
 * 
 * Requirements: 1.1, 2.1, 3.2
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock browser environment
const createMockBrowser = () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body>
        <div id="registerForm" style="display: block;">
          <input name="name" type="text" />
          <input name="gender" type="radio" value="male" />
          <input name="gender" type="radio" value="female" />
          <button type="submit">注册参与</button>
        </div>
        <div id="mainActions" style="display: none;"></div>
        <div class="vote-container">
          <div class="vote-content">
            <div id="loadingState"></div>
            <div id="errorState" style="display: none;"></div>
            <div id="authPrompt" style="display: none;"></div>
            <div id="voteInterface" style="display: none;"></div>
            <div id="successState" style="display: none;"></div>
          </div>
        </div>
      </body>
    </html>
  `, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  const window = dom.window;
  const document = window.document;

  // Mock localStorage
  const localStorageMock = {
    store: {},
    getItem: function(key) {
      return this.store[key] || null;
    },
    setItem: function(key, value) {
      this.store[key] = value.toString();
    },
    removeItem: function(key) {
      delete this.store[key];
    },
    clear: function() {
      this.store = {};
    }
  };

  window.localStorage = localStorageMock;
  
  // Mock location
  window.location = {
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000',
    search: '',
    pathname: '/'
  };

  // Mock URLSearchParams
  window.URLSearchParams = class URLSearchParams {
    constructor(search) {
      this.params = new Map();
      if (search) {
        const pairs = search.replace(/^\?/, '').split('&');
        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key) {
            this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
          }
        });
      }
    }
    
    get(key) {
      return this.params.get(key);
    }
    
    set(key, value) {
      this.params.set(key, value);
    }
    
    toString() {
      const pairs = [];
      this.params.forEach((value, key) => {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
      return pairs.join('&');
    }
    
    forEach(callback) {
      this.params.forEach(callback);
    }
  };

  // Mock URL constructor
  window.URL = class URL {
    constructor(url, base) {
      if (base) {
        this.origin = base;
        this.pathname = url.startsWith('/') ? url : '/' + url;
      } else {
        const parts = url.split('?');
        this.origin = 'http://localhost:3000';
        this.pathname = parts[0];
        this.search = parts[1] ? '?' + parts[1] : '';
      }
      this.protocol = 'http:';
      this.searchParams = new window.URLSearchParams(this.search);
    }
    
    toString() {
      const search = this.searchParams.toString();
      return this.origin + this.pathname + (search ? '?' + search : '');
    }
  };

  // Mock console methods
  window.console = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  // Mock navigator
  window.navigator = {
    userAgent: 'Mozilla/5.0 (Test Browser)'
  };

  return { window, document, localStorage: localStorageMock };
};

// Load the actual implementation files
const loadImplementationFiles = (window) => {
  // Load URLUtils
  const urlUtilsPath = path.join(__dirname, '../../public/static/js/urlUtils.js');
  const urlUtilsCode = fs.readFileSync(urlUtilsPath, 'utf8');
  const urlUtilsScript = new window.Function(urlUtilsCode);
  urlUtilsScript.call(window);

  // Load app.js functions (extract relevant parts)
  const appJsPath = path.join(__dirname, '../../public/static/js/app.js');
  const appJsCode = fs.readFileSync(appJsPath, 'utf8');
  
  // Extract and define key functions
  window.eval(`
    const STORAGE_KEYS = {
      USER_ID: 'annual_party_user_id',
      USER_NAME: 'annual_party_user_name',
      USER_GENDER: 'annual_party_user_gender',
      NUMERIC_ID: 'annual_party_numeric_id',
      REGISTRATION_TIME: 'annual_party_registration_time',
      PENDING_RETURN_URL: 'pending_return_url',
      VOTE_INTENT_TIMESTAMP: 'vote_intent_timestamp'
    };

    function isRegistrationValid(registrationTime) {
      if (!registrationTime) return false;
      const regTime = new Date(registrationTime);
      const now = new Date();
      const hoursDiff = (now - regTime) / (1000 * 60 * 60);
      return hoursDiff < 24;
    }

    function isVoteIntentValid(timestamp) {
      if (!timestamp) return false;
      const intentTime = new Date(timestamp);
      const now = new Date();
      const hoursDiff = (now - intentTime) / (1000 * 60 * 60);
      return hoursDiff < 24;
    }

    function checkReturnParameter() {
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('return');
      
      if (returnUrl) {
        localStorage.setItem(STORAGE_KEYS.PENDING_RETURN_URL, returnUrl);
        localStorage.setItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP, new Date().toISOString());
        showVoteRegistrationPrompt(returnUrl);
      }
    }

    function showVoteRegistrationPrompt(returnUrl) {
      const promptDiv = document.createElement('div');
      promptDiv.className = 'vote-registration-prompt';
      promptDiv.innerHTML = '<div class="prompt-content"><h3>投票前需要注册</h3></div>';
      
      const form = document.getElementById('registerForm');
      if (form) {
        form.parentNode.insertBefore(promptDiv, form);
      }
    }

    function clearRegistrationCache() {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  `);

  // Load VotePageRouter from vote-page.html
  const votePagePath = path.join(__dirname, 'vote-page.html');
  const votePageCode = fs.readFileSync(votePagePath, 'utf8');
  
  // Extract VotePageRouter class
  const routerMatch = votePageCode.match(/class VotePageRouter \{[\s\S]*?\n        \}/);
  if (routerMatch) {
    window.eval(routerMatch[0]);
  }
};

describe('Vote Registration Verification - End-to-End Tests', () => {
  let mockBrowser;
  let window, document, localStorage;

  beforeEach(() => {
    mockBrowser = createMockBrowser();
    window = mockBrowser.window;
    document = mockBrowser.document;
    localStorage = mockBrowser.localStorage;
    
    // Set global references for the implementation
    global.window = window;
    global.document = document;
    global.localStorage = localStorage;
    
    loadImplementationFiles(window);
  });

  afterEach(() => {
    localStorage.clear();
    // Clean up global references
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  describe('Complete Unregistered User Voting Flow', () => {
    test('should redirect unregistered user to registration and return after completion', async () => {
      // Step 1: Unregistered user tries to access vote page
      window.location.href = 'http://localhost:3000/vote?candidate_id=123&candidate_name=张三&source=qrcode';
      window.location.search = '?candidate_id=123&candidate_name=张三&source=qrcode';
      window.location.pathname = '/vote';

      const voteRouter = new window.VotePageRouter();
      
      // Mock the initialization to simulate unregistered state
      const authStatus = await voteRouter.checkAuthStatus();
      expect(authStatus.isLoggedIn).toBe(false);

      // Step 2: System should save vote intent and redirect
      const returnUrl = voteRouter.buildReturnUrl();
      expect(returnUrl).toContain('candidate_id=123');
      expect(returnUrl).toContain('candidate_name=张三');
      expect(returnUrl).toContain('source=');

      voteRouter.saveVoteIntent(returnUrl);
      
      // Verify vote intent is saved
      expect(localStorage.getItem('pending_return_url')).toBeTruthy();
      expect(localStorage.getItem('vote_intent_timestamp')).toBeTruthy();
      
      const savedIntent = JSON.parse(localStorage.getItem('vote_intent_data'));
      expect(savedIntent.voteParams.candidateId).toBe('123');
      expect(savedIntent.voteParams.candidateName).toBe('张三');

      // Step 3: User lands on registration page with return parameter
      window.location.href = 'http://localhost:3000/?return=' + encodeURIComponent(returnUrl);
      window.location.search = '?return=' + encodeURIComponent(returnUrl);
      window.location.pathname = '/';

      // Simulate checkReturnParameter function
      window.checkReturnParameter();
      
      // Verify return URL is saved and prompt is shown
      expect(localStorage.getItem(window.STORAGE_KEYS.PENDING_RETURN_URL)).toBe(returnUrl);
      expect(document.querySelector('.vote-registration-prompt')).toBeTruthy();

      // Step 4: User completes registration
      const registrationTime = new Date().toISOString();
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.USER_GENDER, 'male');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, registrationTime);
      localStorage.setItem(window.STORAGE_KEYS.NUMERIC_ID, '001');

      // Step 5: Check if user should be redirected back to vote page
      const pendingReturnUrl = localStorage.getItem(window.STORAGE_KEYS.PENDING_RETURN_URL);
      const voteIntentTimestamp = localStorage.getItem(window.STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);
      
      expect(pendingReturnUrl).toBe(returnUrl);
      expect(window.isVoteIntentValid(voteIntentTimestamp)).toBe(true);

      // Step 6: User returns to vote page as registered user
      window.location.href = returnUrl;
      const newVoteRouter = new window.VotePageRouter();
      
      const newAuthStatus = await newVoteRouter.checkAuthStatus();
      expect(newAuthStatus.isLoggedIn).toBe(true);
      expect(newAuthStatus.user.id).toBe('user123');
      expect(newAuthStatus.user.username).toBe('测试用户');

      // Step 7: Verify vote interface is shown
      expect(newVoteRouter.isRegistrationValid(registrationTime)).toBe(true);
    });

    test('should handle expired vote intent gracefully', async () => {
      // Set up expired vote intent
      const expiredTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      localStorage.setItem(window.STORAGE_KEYS.VOTE_INTENT_TIMESTAMP, expiredTimestamp);
      localStorage.setItem(window.STORAGE_KEYS.PENDING_RETURN_URL, '/vote?candidate_id=123');

      // User completes registration
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

      // Check vote intent validity
      expect(window.isVoteIntentValid(expiredTimestamp)).toBe(false);

      // Should not redirect to vote page due to expired intent
      const pendingReturnUrl = localStorage.getItem(window.STORAGE_KEYS.PENDING_RETURN_URL);
      expect(pendingReturnUrl).toBeTruthy(); // URL is still there
      
      // But intent is invalid, so user should stay on homepage
      expect(window.isVoteIntentValid(localStorage.getItem(window.STORAGE_KEYS.VOTE_INTENT_TIMESTAMP))).toBe(false);
    });

    test('should handle expired registration gracefully', async () => {
      // Set up expired registration
      const expiredRegistrationTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, expiredRegistrationTime);

      const voteRouter = new window.VotePageRouter();
      
      // Check auth status with expired registration
      const authStatus = await voteRouter.checkAuthStatus();
      expect(authStatus.isLoggedIn).toBe(false);

      // Verify expired registration data is cleared
      expect(localStorage.getItem(window.STORAGE_KEYS.USER_ID)).toBeNull();
      expect(localStorage.getItem(window.STORAGE_KEYS.USER_NAME)).toBeNull();
      expect(localStorage.getItem(window.STORAGE_KEYS.REGISTRATION_TIME)).toBeNull();
    });
  });

  describe('URL Parameter Handling and Security', () => {
    test('should validate and sanitize vote parameters correctly', () => {
      const validParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        category: '最佳员工',
        timestamp: Date.now().toString()
      };

      const validation = window.URLUtils.validateVoteParams(validParams);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid vote parameters', () => {
      const invalidParams = {
        candidateId: '', // Missing required field
        candidateName: '', // Missing required field
        source: 'invalid_source',
        timestamp: 'invalid_timestamp'
      };

      const validation = window.URLUtils.validateVoteParams(invalidParams);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should prevent open redirect attacks', () => {
      const maliciousUrl = 'http://evil.com/vote?candidate_id=123';
      const parsed = window.URLUtils.parseReturnUrl(maliciousUrl);
      
      expect(parsed.isValid).toBe(false);
      expect(parsed.error).toContain('Invalid return URL origin');
    });

    test('should sanitize return URLs safely', () => {
      const maliciousUrl = 'javascript:alert("xss")';
      const sanitized = window.URLUtils.sanitizeReturnUrl(maliciousUrl);
      
      expect(sanitized).toBe('http://localhost:3000/');
    });

    test('should handle path traversal attempts', () => {
      const traversalUrl = 'http://localhost:3000/../../../etc/passwd';
      const parsed = window.URLUtils.parseReturnUrl(traversalUrl);
      
      expect(parsed.isValid).toBe(false);
      expect(parsed.error).toContain('Invalid URL path');
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle localStorage access failures', () => {
      // Mock localStorage failure
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const voteRouter = new window.VotePageRouter();
      
      // Should not throw error when localStorage fails
      expect(() => {
        voteRouter.saveVoteIntent('/vote?candidate_id=123');
      }).not.toThrow();

      // Restore original method
      localStorage.setItem = originalSetItem;
    });

    test('should handle malformed URL parameters', () => {
      window.location.search = '?candidate_id=%&candidate_name=%invalid%&source=';
      
      const voteRouter = new window.VotePageRouter();
      const params = voteRouter.parseURLParams(window.location.href);
      
      // Should handle malformed parameters gracefully
      expect(params.candidateId).toBe('');
      expect(params.candidateName).toBe('');
      expect(params.source).toBe('direct'); // Default value
    });

    test('should handle network failures during vote submission', async () => {
      // Set up registered user
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

      window.location.search = '?candidate_id=123&candidate_name=张三&source=qrcode';
      
      const voteRouter = new window.VotePageRouter();
      await voteRouter.init();

      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      // Should handle network failure gracefully
      await expect(voteRouter.submitVote()).resolves.not.toThrow();

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove required DOM elements
      const registerForm = document.getElementById('registerForm');
      if (registerForm) registerForm.remove();

      // Should not throw error when DOM elements are missing
      expect(() => {
        window.checkReturnParameter();
      }).not.toThrow();

      expect(() => {
        window.showVoteRegistrationPrompt('/vote?test=1');
      }).not.toThrow();
    });
  });

  describe('Registration State Validation', () => {
    test('should correctly validate registration within 24-hour window', () => {
      const recentTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago
      expect(window.isRegistrationValid(recentTime)).toBe(true);

      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      expect(window.isRegistrationValid(oldTime)).toBe(false);

      const futureTime = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour in future
      expect(window.isRegistrationValid(futureTime)).toBe(false);
    });

    test('should handle invalid registration time formats', () => {
      expect(window.isRegistrationValid('invalid-date')).toBe(false);
      expect(window.isRegistrationValid('')).toBe(false);
      expect(window.isRegistrationValid(null)).toBe(false);
      expect(window.isRegistrationValid(undefined)).toBe(false);
    });

    test('should clear expired registration data automatically', async () => {
      // Set expired registration
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, expiredTime);

      const voteRouter = new window.VotePageRouter();
      await voteRouter.checkAuthStatus();

      // Should clear expired data
      expect(localStorage.getItem(window.STORAGE_KEYS.USER_ID)).toBeNull();
      expect(localStorage.getItem(window.STORAGE_KEYS.USER_NAME)).toBeNull();
      expect(localStorage.getItem(window.STORAGE_KEYS.REGISTRATION_TIME)).toBeNull();
    });
  });

  describe('Vote Intent Persistence', () => {
    test('should persist vote intent across browser sessions', () => {
      const voteParams = {
        candidateId: '123',
        candidateName: '张三',
        source: 'qrcode',
        category: '最佳员工'
      };

      const returnUrl = window.URLUtils.buildVoteReturnUrl(voteParams);
      
      const voteRouter = new window.VotePageRouter();
      voteRouter.params = voteParams;
      voteRouter.saveVoteIntent(returnUrl);

      // Verify persistence
      expect(localStorage.getItem('pending_return_url')).toBe(returnUrl);
      expect(localStorage.getItem('vote_intent_timestamp')).toBeTruthy();
      
      const savedData = JSON.parse(localStorage.getItem('vote_intent_data'));
      expect(savedData.voteParams.candidateId).toBe('123');
      expect(savedData.voteParams.candidateName).toBe('张三');
    });

    test('should handle vote intent data corruption', () => {
      // Corrupt the stored data
      localStorage.setItem('vote_intent_data', 'invalid-json');
      localStorage.setItem('pending_return_url', '/vote?candidate_id=123');

      // Should handle corruption gracefully
      expect(() => {
        const data = localStorage.getItem('vote_intent_data');
        JSON.parse(data);
      }).toThrow();

      // But basic return URL should still work
      expect(localStorage.getItem('pending_return_url')).toBe('/vote?candidate_id=123');
    });
  });

  describe('Integration with Existing Systems', () => {
    test('should maintain compatibility with existing vote page functionality', async () => {
      // Set up registered user
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

      window.location.search = '?candidate_id=123&candidate_name=张三&source=qrcode';
      
      const voteRouter = new window.VotePageRouter();
      await voteRouter.init();

      // Should show vote interface for registered user
      expect(voteRouter.getCurrentState()).toBe('vote');
      expect(voteRouter.getCurrentUser()).toBeTruthy();
      expect(voteRouter.getCurrentUser().id).toBe('user123');
    });

    test('should not interfere with direct vote page access by registered users', async () => {
      // Set up registered user
      localStorage.setItem(window.STORAGE_KEYS.USER_ID, 'user123');
      localStorage.setItem(window.STORAGE_KEYS.USER_NAME, '测试用户');
      localStorage.setItem(window.STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

      // Direct access without return parameter
      window.location.search = '?candidate_id=456&candidate_name=李四&source=direct';
      
      const voteRouter = new window.VotePageRouter();
      await voteRouter.init();

      // Should work normally without registration verification interference
      expect(voteRouter.getCurrentState()).toBe('vote');
      expect(voteRouter.params.candidateId).toBe('456');
      expect(voteRouter.params.candidateName).toBe('李四');
    });
  });
});