/**
 * Vote Page Component - JavaScript Module
 * Implements the voting page route component for Node.js applications
 * Based on requirements 2.1 and 2.2 from the QR Code Voting URL specification
 */

/**
 * Vote Page Component Class
 * Handles URL parameter parsing, state management, and user interface rendering
 */
class VotePageComponent {
    constructor(options = {}) {
        this.baseURL = options.baseURL || 'https://domain.com';
        this.apiEndpoint = options.apiEndpoint || '/api';
        this.authEndpoint = options.authEndpoint || '/auth';
        this.state = 'loading';
        this.params = null;
        this.user = null;
        this.container = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.parseURLParams = this.parseURLParams.bind(this);
        this.validateParams = this.validateParams.bind(this);
        this.render = this.render.bind(this);
        this.submitVote = this.submitVote.bind(this);
    }

    /**
     * Initialize the vote page component
     * @param {string} url - URL to parse parameters from
     * @param {HTMLElement} container - Container element to render into
     */
    async init(url, container) {
        this.container = container;
        
        try {
            // Show loading state
            this.setState('loading');
            this.render();
            
            // Parse URL parameters
            this.params = this.parseURLParams(url);
            
            // Validate parameters
            const validation = this.validateParams(this.params);
            
            if (!validation.isValid) {
                this.setState('error', {
                    title: '参数错误',
                    message: validation.errors.join(', ')
                });
                this.render();
                return;
            }

            // Use sanitized parameters
            this.params = validation.sanitizedParams || this.params;

            // Check authentication status
            const authStatus = await this.checkAuthStatus();
            
            if (!authStatus.isLoggedIn) {
                this.setState('auth', {
                    returnUrl: url
                });
                this.render();
                return;
            }

            this.user = authStatus.user;
            
            // Check voting eligibility
            const canVote = await this.checkVotingEligibility();
            
            if (!canVote.eligible) {
                this.setState('error', {
                    title: '投票限制',
                    message: canVote.reason
                });
                this.render();
                return;
            }

            // Show vote interface
            this.setState('vote');
            this.render();
            
        } catch (error) {
            console.error('Vote page initialization error:', error);
            this.setState('error', {
                title: '系统错误',
                message: '页面加载失败，请稍后重试'
            });
            this.render();
        }
    }

    /**
     * Parse URL parameters into vote page parameters
     * @param {string} url - URL to parse
     * @returns {Object} Parsed parameters
     */
    parseURLParams(url) {
        try {
            let queryString;
            
            if (url.includes('?')) {
                if (url.startsWith('http')) {
                    const urlObj = new URL(url);
                    queryString = urlObj.search.substring(1);
                } else {
                    queryString = url.substring(url.indexOf('?') + 1);
                }
            } else {
                queryString = url;
            }
            
            const params = new URLSearchParams(queryString);
            
            return {
                candidateId: this.sanitizeInput(params.get('candidate_id') || ''),
                candidateName: this.sanitizeInput(params.get('candidate_name') || ''),
                source: params.get('source') || 'direct',
                category: this.sanitizeInput(params.get('category') || ''),
                timestamp: this.sanitizeInput(params.get('timestamp') || '')
            };
        } catch (error) {
            console.warn('Failed to parse URL parameters:', error);
            return {
                candidateId: '',
                candidateName: '',
                source: 'direct',
                category: '',
                timestamp: ''
            };
        }
    }

    /**
     * Sanitize input to prevent XSS attacks
     * @param {string} input - Input to sanitize
     * @returns {string} Sanitized input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input
            .replace(/[<>]/g, '') // Remove dangerous HTML chars
            .replace(/['"]/g, '') // Remove quotes
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .trim();
    }

    /**
     * Validate vote page parameters
     * @param {Object} params - Parameters to validate
     * @returns {Object} Validation result
     */
    validateParams(params) {
        const errors = [];
        
        // Check required parameters
        if (!params.candidateId) {
            errors.push('缺少候选人ID');
        }
        
        if (!params.candidateName) {
            errors.push('缺少候选人姓名');
        }
        
        // Validate candidate ID format
        if (params.candidateId && !/^[a-zA-Z0-9\-_]+$/.test(params.candidateId)) {
            errors.push('候选人ID格式无效');
        }
        
        // Validate candidate name
        if (params.candidateName && (params.candidateName.length < 1 || params.candidateName.length > 50)) {
            errors.push('候选人姓名长度无效');
        }
        
        // Validate source
        if (params.source && !['qrcode', 'direct'].includes(params.source)) {
            errors.push('来源参数无效');
        }
        
        // Validate timestamp if provided
        if (params.timestamp) {
            const timestamp = parseInt(params.timestamp);
            if (isNaN(timestamp)) {
                errors.push('时间戳格式无效');
            } else {
                const now = Math.floor(Date.now() / 1000);
                const maxAge = 24 * 60 * 60; // 24 hours
                if (now - timestamp > maxAge) {
                    errors.push('链接已过期');
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            sanitizedParams: errors.length === 0 ? {
                candidateId: params.candidateId.trim(),
                candidateName: params.candidateName.trim(),
                source: params.source,
                category: params.category ? params.category.trim() : undefined,
                timestamp: params.timestamp ? params.timestamp.trim() : undefined
            } : undefined
        };
    }

    /**
     * Check user authentication status
     * @returns {Promise<Object>} Authentication status
     */
    async checkAuthStatus() {
        try {
            // In a real application, this would make an API call
            // For now, simulate with localStorage
            if (typeof localStorage !== 'undefined') {
                const userId = localStorage.getItem('annual_party_user_id');
                const userName = localStorage.getItem('annual_party_user_name');
                
                if (userId && userName) {
                    return {
                        isLoggedIn: true,
                        user: {
                            id: userId,
                            username: userName,
                            email: `${userName}@example.com`,
                            hasVotingRights: true
                        }
                    };
                }
            }
            
            return {
                isLoggedIn: false
            };
        } catch (error) {
            console.error('Auth status check error:', error);
            return {
                isLoggedIn: false
            };
        }
    }

    /**
     * Check if user is eligible to vote for the candidate
     * @returns {Promise<Object>} Voting eligibility result
     */
    async checkVotingEligibility() {
        try {
            // Check if user is trying to vote for themselves
            if (this.user && this.params.candidateId === this.user.id) {
                return {
                    eligible: false,
                    reason: '不能为自己投票'
                };
            }
            
            // Check if user has already voted for this candidate
            if (typeof localStorage !== 'undefined') {
                const existingVote = localStorage.getItem(`vote_${this.user.id}_${this.params.candidateId}`);
                if (existingVote) {
                    return {
                        eligible: false,
                        reason: '您已经为该候选人投过票了'
                    };
                }
            }
            
            return {
                eligible: true
            };
        } catch (error) {
            console.error('Voting eligibility check error:', error);
            return {
                eligible: false,
                reason: '无法验证投票资格'
            };
        }
    }

    /**
     * Set component state
     * @param {string} state - New state
     * @param {Object} data - Additional state data
     */
    setState(state, data = {}) {
        this.state = state;
        this.stateData = data;
    }

    /**
     * Render the component based on current state
     */
    render() {
        if (!this.container) return;

        let html = '';

        switch (this.state) {
            case 'loading':
                html = this.renderLoadingState();
                break;
            case 'error':
                html = this.renderErrorState();
                break;
            case 'auth':
                html = this.renderAuthPrompt();
                break;
            case 'vote':
                html = this.renderVoteInterface();
                break;
            case 'success':
                html = this.renderSuccessState();
                break;
            default:
                html = this.renderErrorState();
        }

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Render loading state
     * @returns {string} HTML for loading state
     */
    renderLoadingState() {
        return `
            <div class="vote-page-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">正在加载投票信息...</div>
            </div>
        `;
    }

    /**
     * Render error state
     * @returns {string} HTML for error state
     */
    renderErrorState() {
        const { title = '错误', message = '发生未知错误' } = this.stateData || {};
        return `
            <div class="vote-page-error">
                <div class="error-icon">⚠️</div>
                <div class="error-title">${this.escapeHtml(title)}</div>
                <div class="error-message">${this.escapeHtml(message)}</div>
                <div class="error-actions">
                    <button class="btn btn-secondary" onclick="window.history.back()">返回</button>
                    <a href="/" class="btn btn-primary">返回首页</a>
                </div>
            </div>
        `;
    }

    /**
     * Render authentication prompt
     * @returns {string} HTML for auth prompt
     */
    renderAuthPrompt() {
        const { returnUrl = '' } = this.stateData || {};
        const encodedReturnUrl = encodeURIComponent(returnUrl);
        
        return `
            <div class="vote-page-auth">
                <div class="auth-icon">🔐</div>
                <div class="auth-title">需要登录</div>
                <div class="auth-message">请先登录或注册以获得投票权限</div>
                <div class="auth-actions">
                    <a href="/login?return=${encodedReturnUrl}" class="btn btn-primary">登录</a>
                    <a href="/register?return=${encodedReturnUrl}" class="btn btn-secondary">注册</a>
                </div>
            </div>
        `;
    }

    /**
     * Render vote interface
     * @returns {string} HTML for vote interface
     */
    renderVoteInterface() {
        const sourceBadge = this.params.source === 'qrcode' 
            ? '<div class="status-badge status-qrcode">📱 扫码投票</div>'
            : '<div class="status-badge status-direct">🔗 直接访问</div>';

        const categoryHtml = this.params.category 
            ? `<div class="candidate-category">${this.escapeHtml(this.params.category)}</div>`
            : '';

        return `
            <div class="vote-page-interface">
                ${sourceBadge}
                
                <div class="candidate-info">
                    <div class="candidate-name">${this.escapeHtml(this.params.candidateName)}</div>
                    <div class="candidate-id">ID: ${this.escapeHtml(this.params.candidateId)}</div>
                    ${categoryHtml}
                </div>

                <div class="vote-actions">
                    <button class="btn btn-primary" id="voteBtn">投票支持</button>
                    <a href="/" class="btn btn-secondary">返回首页</a>
                </div>
            </div>
        `;
    }

    /**
     * Render success state
     * @returns {string} HTML for success state
     */
    renderSuccessState() {
        const { message = '投票成功！' } = this.stateData || {};
        return `
            <div class="vote-page-success">
                <div class="success-icon">✅</div>
                <div class="success-title">投票成功</div>
                <div class="success-message">${this.escapeHtml(message)}</div>
                <div class="success-actions">
                    <a href="/" class="btn btn-primary">返回首页</a>
                    <a href="/results" class="btn btn-secondary">查看结果</a>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners after rendering
     */
    attachEventListeners() {
        const voteBtn = this.container.querySelector('#voteBtn');
        if (voteBtn) {
            voteBtn.addEventListener('click', this.submitVote);
        }
    }

    /**
     * Submit vote
     */
    async submitVote() {
        const voteBtn = this.container.querySelector('#voteBtn');
        if (!voteBtn) return;

        const originalText = voteBtn.textContent;
        
        try {
            voteBtn.textContent = '投票中...';
            voteBtn.disabled = true;
            
            // Simulate vote submission
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Record vote locally (for demo purposes)
            if (typeof localStorage !== 'undefined') {
                const voteRecord = {
                    voterId: this.user.id,
                    candidateId: this.params.candidateId,
                    candidateName: this.params.candidateName,
                    timestamp: new Date().toISOString(),
                    source: this.params.source
                };
                
                localStorage.setItem(`vote_${this.user.id}_${this.params.candidateId}`, JSON.stringify(voteRecord));
            }
            
            // Show success
            this.setState('success', {
                message: `您已成功为 ${this.params.candidateName} 投票！`
            });
            this.render();
            
        } catch (error) {
            console.error('Vote submission error:', error);
            this.setState('error', {
                title: '投票失败',
                message: '投票提交失败，请稍后重试'
            });
            this.render();
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get current parameters
     * @returns {Object} Current parameters
     */
    getCurrentParams() {
        return this.params;
    }

    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.state;
    }

    /**
     * Get current user
     * @returns {Object} Current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Destroy the component and clean up
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.container = null;
        this.params = null;
        this.user = null;
        this.state = 'loading';
    }
}

/**
 * Factory function to create a vote page component
 * @param {Object} options - Component options
 * @returns {VotePageComponent} New component instance
 */
function createVotePageComponent(options = {}) {
    return new VotePageComponent(options);
}

/**
 * Utility functions for vote page component
 */
const VotePageUtils = {
    /**
     * Parse URL parameters quickly
     * @param {string} url - URL to parse
     * @returns {Object} Parsed parameters
     */
    parseURL(url) {
        const component = new VotePageComponent();
        return component.parseURLParams(url);
    },

    /**
     * Validate parameters quickly
     * @param {Object} params - Parameters to validate
     * @returns {Object} Validation result
     */
    validateParams(params) {
        const component = new VotePageComponent();
        return component.validateParams(params);
    },

    /**
     * Check if URL has valid voting parameters
     * @param {string} url - URL to check
     * @returns {boolean} Whether URL is valid
     */
    isValidVotingURL(url) {
        const component = new VotePageComponent();
        const params = component.parseURLParams(url);
        const validation = component.validateParams(params);
        return validation.isValid;
    },

    /**
     * Extract candidate information from URL
     * @param {string} url - URL to parse
     * @returns {Object|null} Candidate info or null
     */
    extractCandidateInfo(url) {
        const component = new VotePageComponent();
        const params = component.parseURLParams(url);
        const validation = component.validateParams(params);
        
        if (!validation.isValid) return null;
        
        const sanitized = validation.sanitizedParams;
        return {
            id: sanitized.candidateId,
            name: sanitized.candidateName,
            category: sanitized.category
        };
    }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VotePageComponent,
        createVotePageComponent,
        VotePageUtils
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.VotePageComponent = VotePageComponent;
    window.createVotePageComponent = createVotePageComponent;
    window.VotePageUtils = VotePageUtils;
}