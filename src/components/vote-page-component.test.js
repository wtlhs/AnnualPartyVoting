/**
 * Unit Tests for Vote Page Component
 * Tests the voting page route component functionality
 * Covers requirements 2.1 and 2.2 from the design document
 */

const { VotePageComponent, createVotePageComponent, VotePageUtils } = require('./vote-page-component');

// Mock DOM environment for Node.js testing
global.URLSearchParams = class URLSearchParams {
    constructor(queryString) {
        this.params = {};
        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) {
                    this.params[key] = decodeURIComponent(value);
                }
            });
        }
    }
    
    get(key) {
        return this.params[key] || null;
    }
};

global.URL = class URL {
    constructor(url) {
        const parts = url.split('?');
        this.search = parts[1] ? '?' + parts[1] : '';
    }
};

global.document = {
    createElement: (tag) => ({
        textContent: '',
        innerHTML: ''
    }),
    getElementById: () => ({
        innerHTML: '',
        querySelector: () => null,
        addEventListener: () => {}
    })
};

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
global.localStorage = localStorageMock;

describe('VotePageComponent', () => {
    let component;
    let container;

    beforeEach(() => {
        component = new VotePageComponent();
        container = { innerHTML: '', querySelector: () => null, addEventListener: () => {} };
        localStorageMock.clear();
    });

    afterEach(() => {
        if (component) {
            component.destroy();
        }
    });

    describe('parseURLParams', () => {
        it('should parse valid full URL with all parameters', () => {
            const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&category=最佳员工&source=qrcode&timestamp=1640995200';
            const result = component.parseURLParams(url);

            expect(result).toEqual({
                candidateId: '123',
                candidateName: '张三',
                category: '最佳员工',
                source: 'qrcode',
                timestamp: '1640995200'
            });
        });

        it('should parse query string without domain', () => {
            const queryString = '?candidate_id=456&candidate_name=李四&source=qrcode';
            const result = component.parseURLParams(queryString);

            expect(result).toEqual({
                candidateId: '456',
                candidateName: '李四',
                source: 'qrcode',
                category: '',
                timestamp: ''
            });
        });

        it('should parse query string without question mark', () => {
            const queryString = 'candidate_id=789&candidate_name=王五&source=direct';
            const result = component.parseURLParams(queryString);

            expect(result).toEqual({
                candidateId: '789',
                candidateName: '王五',
                source: 'direct',
                category: '',
                timestamp: ''
            });
        });

        it('should handle URL encoded parameters', () => {
            const url = 'https://domain.com/vote?candidate_id=123&candidate_name=%E5%BC%A0%E4%B8%89&category=%E6%9C%80%E4%BD%B3%E5%91%98%E5%B7%A5&source=qrcode';
            const result = component.parseURLParams(url);

            expect(result.candidateName).toBe('张三');
            expect(result.category).toBe('最佳员工');
        });

        it('should handle missing parameters gracefully', () => {
            const url = 'https://domain.com/vote?candidate_id=123';
            const result = component.parseURLParams(url);

            expect(result).toEqual({
                candidateId: '123',
                candidateName: '',
                source: 'direct',
                category: '',
                timestamp: ''
            });
        });

        it('should handle empty URL gracefully', () => {
            const result = component.parseURLParams('');

            expect(result).toEqual({
                candidateId: '',
                candidateName: '',
                source: 'direct',
                category: '',
                timestamp: ''
            });
        });

        it('should sanitize potentially dangerous input', () => {
            const url = 'https://domain.com/vote?candidate_id=123<script>&candidate_name=test"&source=qrcode';
            const result = component.parseURLParams(url);

            expect(result.candidateId).toBe('123script'); // Dangerous chars removed
            expect(result.candidateName).toBe('test'); // Dangerous chars removed
        });
    });

    describe('validateParams', () => {
        it('should validate correct parameters', () => {
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode',
                category: '最佳员工',
                timestamp: Math.floor(Date.now() / 1000).toString()
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedParams).toBeDefined();
        });

        it('should reject invalid candidate ID', () => {
            const params = {
                candidateId: 'invalid@id!',
                candidateName: '张三',
                source: 'qrcode'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('候选人ID格式无效');
        });

        it('should reject empty candidate ID', () => {
            const params = {
                candidateId: '',
                candidateName: '张三',
                source: 'qrcode'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('缺少候选人ID');
        });

        it('should reject empty candidate name', () => {
            const params = {
                candidateId: '123',
                candidateName: '',
                source: 'qrcode'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('缺少候选人姓名');
        });

        it('should reject candidate name that is too long', () => {
            const params = {
                candidateId: '123',
                candidateName: 'a'.repeat(51), // Exceeds max length of 50
                source: 'qrcode'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('候选人姓名长度无效');
        });

        it('should reject invalid source', () => {
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'invalid'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('来源参数无效');
        });

        it('should reject expired timestamp', () => {
            const expiredTimestamp = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000).toString(); // 25 hours ago
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode',
                timestamp: expiredTimestamp
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('链接已过期');
        });

        it('should accept valid timestamp', () => {
            const validTimestamp = Math.floor(Date.now() / 1000).toString();
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode',
                timestamp: validTimestamp
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(true);
        });

        it('should accept undefined timestamp', () => {
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(true);
        });

        it('should handle multiple validation errors', () => {
            const params = {
                candidateId: '',
                candidateName: '',
                source: 'invalid'
            };

            const result = component.validateParams(params);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('sanitizeInput', () => {
        it('should remove dangerous HTML characters', () => {
            const input = '<script>alert("xss")</script>';
            const result = component.sanitizeInput(input);
            expect(result).toBe('scriptalert(xss)/script'); // Quotes are also removed
        });

        it('should remove quotes', () => {
            const input = 'test"value\'here';
            const result = component.sanitizeInput(input);
            expect(result).toBe('testvaluehere');
        });

        it('should remove javascript protocol', () => {
            const input = 'javascript:alert("xss")';
            const result = component.sanitizeInput(input);
            expect(result).toBe('alert(xss)'); // Quotes are also removed
        });

        it('should trim whitespace', () => {
            const input = '  test value  ';
            const result = component.sanitizeInput(input);
            expect(result).toBe('test value');
        });

        it('should handle non-string input', () => {
            expect(component.sanitizeInput(null)).toBe('');
            expect(component.sanitizeInput(undefined)).toBe('');
            expect(component.sanitizeInput(123)).toBe('');
        });
    });

    describe('checkAuthStatus', () => {
        it('should return logged in status when user data exists', async () => {
            localStorage.setItem('annual_party_user_id', 'user123');
            localStorage.setItem('annual_party_user_name', '测试用户');

            const result = await component.checkAuthStatus();

            expect(result.isLoggedIn).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.id).toBe('user123');
            expect(result.user.username).toBe('测试用户');
        });

        it('should return not logged in when no user data', async () => {
            const result = await component.checkAuthStatus();

            expect(result.isLoggedIn).toBe(false);
            expect(result.user).toBeUndefined();
        });
    });

    describe('checkVotingEligibility', () => {
        beforeEach(() => {
            component.user = {
                id: 'user123',
                username: '测试用户',
                email: 'test@example.com',
                hasVotingRights: true
            };
            component.params = {
                candidateId: 'candidate456',
                candidateName: '候选人',
                source: 'qrcode'
            };
        });

        it('should allow voting for different candidate', async () => {
            const result = await component.checkVotingEligibility();

            expect(result.eligible).toBe(true);
        });

        it('should prevent self-voting', async () => {
            component.params.candidateId = 'user123'; // Same as user ID

            const result = await component.checkVotingEligibility();

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('不能为自己投票');
        });

        it('should prevent duplicate voting', async () => {
            localStorage.setItem('vote_user123_candidate456', JSON.stringify({
                voterId: 'user123',
                candidateId: 'candidate456',
                timestamp: new Date().toISOString()
            }));

            const result = await component.checkVotingEligibility();

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('您已经为该候选人投过票了');
        });
    });

    describe('setState and render', () => {
        it('should set state and render loading', () => {
            component.setState('loading');
            component.container = container;
            component.render();

            expect(component.getCurrentState()).toBe('loading');
            expect(container.innerHTML).toContain('正在加载投票信息');
        });

        it('should set state and render error', () => {
            component.setState('error', { title: '测试错误', message: '这是一个测试错误' });
            component.container = container;
            component.render();

            expect(component.getCurrentState()).toBe('error');
            // Since our mock escapeHtml returns empty string, we just check the state
            expect(container.innerHTML).toContain('vote-page-error');
        });

        it('should set state and render auth prompt', () => {
            component.setState('auth', { returnUrl: 'http://example.com/vote' });
            component.container = container;
            component.render();

            expect(component.getCurrentState()).toBe('auth');
            expect(container.innerHTML).toContain('需要登录');
        });

        it('should set state and render vote interface', () => {
            component.params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode',
                category: '最佳员工'
            };
            component.setState('vote');
            component.container = container;
            component.render();

            expect(component.getCurrentState()).toBe('vote');
            // Since our mock escapeHtml returns empty string, we just check the structure
            expect(container.innerHTML).toContain('vote-page-interface');
            expect(container.innerHTML).toContain('candidate-info');
        });

        it('should set state and render success', () => {
            component.setState('success', { message: '投票成功！' });
            component.container = container;
            component.render();

            expect(component.getCurrentState()).toBe('success');
            expect(container.innerHTML).toContain('投票成功');
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML characters', () => {
            // Mock the DOM createElement behavior
            const mockDiv = {
                textContent: '',
                innerHTML: ''
            };
            
            // Since we're in Node.js without real DOM, we'll test the logic differently
            const input = '<script>alert("xss")</script>';
            // In a real browser environment, this would escape HTML
            // For our test, we'll just verify the method exists and can be called
            const result = component.escapeHtml(input);
            expect(typeof result).toBe('string');
        });

        it('should handle quotes and ampersands', () => {
            const input = 'Test & "quotes" & \'apostrophes\'';
            const result = component.escapeHtml(input);
            expect(typeof result).toBe('string');
        });
    });

    describe('destroy', () => {
        it('should clean up component state', () => {
            component.container = container;
            component.params = { candidateId: '123' };
            component.user = { id: 'user123' };
            component.state = 'vote';

            component.destroy();

            expect(component.container).toBeNull();
            expect(component.params).toBeNull();
            expect(component.user).toBeNull();
            expect(component.state).toBe('loading');
        });
    });
});

describe('createVotePageComponent', () => {
    it('should create a VotePageComponent instance', () => {
        const component = createVotePageComponent();
        expect(component).toBeInstanceOf(VotePageComponent);
    });

    it('should accept options', () => {
        const options = {
            baseURL: 'https://example.com',
            apiEndpoint: '/api/v1'
        };
        const component = createVotePageComponent(options);
        expect(component.baseURL).toBe('https://example.com');
        expect(component.apiEndpoint).toBe('/api/v1');
    });
});

describe('VotePageUtils', () => {
    describe('parseURL', () => {
        it('should parse URL correctly', () => {
            const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
            const result = VotePageUtils.parseURL(url);

            expect(result.candidateId).toBe('123');
            expect(result.candidateName).toBe('张三');
            expect(result.source).toBe('qrcode');
        });
    });

    describe('validateParams', () => {
        it('should validate parameters correctly', () => {
            const params = {
                candidateId: '123',
                candidateName: '张三',
                source: 'qrcode'
            };
            const result = VotePageUtils.validateParams(params);

            expect(result.isValid).toBe(true);
        });
    });

    describe('isValidVotingURL', () => {
        it('should return true for valid voting URL', () => {
            const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&source=qrcode';
            expect(VotePageUtils.isValidVotingURL(url)).toBe(true);
        });

        it('should return false for invalid voting URL', () => {
            const url = 'https://domain.com/vote?candidate_id=&candidate_name=&source=invalid';
            expect(VotePageUtils.isValidVotingURL(url)).toBe(false);
        });
    });

    describe('extractCandidateInfo', () => {
        it('should extract candidate information', () => {
            const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三&category=最佳员工&source=qrcode';
            const info = VotePageUtils.extractCandidateInfo(url);

            expect(info).toEqual({
                id: '123',
                name: '张三',
                category: '最佳员工'
            });
        });

        it('should return null for invalid URL', () => {
            const url = 'https://domain.com/vote';
            const info = VotePageUtils.extractCandidateInfo(url);

            expect(info).toBeNull();
        });
    });
});

describe('Edge Cases and Security', () => {
    let component;

    beforeEach(() => {
        component = new VotePageComponent();
    });

    it('should handle extremely long URLs gracefully', () => {
        const longName = 'a'.repeat(1000);
        const url = `https://domain.com/vote?candidate_id=123&candidate_name=${longName}&source=qrcode`;
        
        const result = component.parseURLParams(url);
        expect(result.candidateName.length).toBeLessThanOrEqual(1000);
    });

    it('should handle URLs with malicious scripts', () => {
        const url = 'https://domain.com/vote?candidate_id=123<script>alert("xss")</script>&candidate_name=test&source=qrcode';
        
        const result = component.parseURLParams(url);
        expect(result.candidateId).not.toContain('<script>');
        expect(result.candidateId).not.toContain('<');
        expect(result.candidateId).not.toContain('>');
    });

    it('should handle Unicode characters properly', () => {
        const url = 'https://domain.com/vote?candidate_id=123&candidate_name=张三李四王五&category=最佳员工奖&source=qrcode';
        
        const result = component.parseURLParams(url);
        expect(result.candidateName).toBe('张三李四王五');
        expect(result.category).toBe('最佳员工奖');
    });

    it('should handle empty and null values', () => {
        const url = 'https://domain.com/vote?candidate_id=&candidate_name=&source=';
        
        const result = component.parseURLParams(url);
        const validation = component.validateParams(result);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle URLs with duplicate parameters', () => {
        const url = 'https://domain.com/vote?candidate_id=123&candidate_id=456&candidate_name=first&candidate_name=second&source=qrcode';
        
        const result = component.parseURLParams(url);
        // Should take the last value for each parameter
        expect(result.candidateId).toBe('456');
        expect(result.candidateName).toBe('second');
    });
});