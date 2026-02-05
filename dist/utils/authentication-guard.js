"use strict";
/**
 * Authentication Guard Implementation
 *
 * This module implements the AuthenticationGuard interface from the design document.
 * It provides user login status checking, session validation, and voting permission verification.
 *
 * Requirements: 3.1, 3.4
 * Design: AuthenticationGuard interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUtils = exports.authGuard = exports.VotingAuthenticationGuard = void 0;
exports.createAuthenticationGuard = createAuthenticationGuard;
const qr_code_voting_1 = require("../types/qr-code-voting");
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    baseURL: '/api',
    sessionStorageKey: 'voting_session',
    localStorageKey: 'voting_user',
    loginPageURL: '/login',
    registrationPageURL: '/register',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
};
/**
 * Authentication Guard implementation
 *
 * Provides comprehensive authentication state management for the voting system.
 * Integrates with existing user authentication infrastructure while providing
 * QR code voting specific functionality.
 */
class VotingAuthenticationGuard {
    constructor(config = {}) {
        this.currentSession = null;
        this.sessionCheckInterval = null;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeSessionMonitoring();
        this.loadPersistedSession();
    }
    /**
     * Check current user login status
     *
     * This method checks both in-memory session and persistent storage
     * to determine the user's current authentication status.
     *
     * @returns Promise<AuthStatus> - Current authentication status
     */
    async checkLoginStatus() {
        try {
            // First check in-memory session
            if (this.currentSession) {
                const now = new Date();
                // Check if session has expired
                if (now > this.currentSession.expiresAt) {
                    await this.clearSession();
                    return {
                        isLoggedIn: false,
                        sessionExpiry: this.currentSession.expiresAt
                    };
                }
                // Check for session timeout due to inactivity
                const timeSinceLastActivity = now.getTime() - this.currentSession.lastActivity.getTime();
                if (timeSinceLastActivity > this.config.sessionTimeout) {
                    await this.clearSession();
                    return {
                        isLoggedIn: false,
                        sessionExpiry: this.currentSession.expiresAt
                    };
                }
                // Update last activity
                this.currentSession.lastActivity = now;
                this.persistSession();
                return {
                    isLoggedIn: true,
                    user: this.currentSession.user,
                    sessionExpiry: this.currentSession.expiresAt
                };
            }
            // Check persistent storage
            const persistedUser = this.loadFromStorage();
            if (persistedUser) {
                // Validate with server
                const serverValidation = await this.validateWithServer(persistedUser);
                if (serverValidation.isValid) {
                    // Restore session
                    this.currentSession = {
                        user: serverValidation.user,
                        token: serverValidation.token,
                        expiresAt: serverValidation.expiresAt || new Date(Date.now() + this.config.sessionTimeout),
                        lastActivity: new Date()
                    };
                    return {
                        isLoggedIn: true,
                        user: this.currentSession.user,
                        sessionExpiry: this.currentSession.expiresAt
                    };
                }
                else {
                    // Clear invalid persistent data
                    this.clearPersistentStorage();
                }
            }
            // No valid session found
            return {
                isLoggedIn: false
            };
        }
        catch (error) {
            console.error('Error checking login status:', error);
            // On error, assume not logged in for security
            return {
                isLoggedIn: false
            };
        }
    }
    /**
     * Require user authentication
     *
     * This method ensures the user is authenticated and has voting rights.
     * If not authenticated, it returns null. If authenticated but without
     * voting rights, it still returns the user but the caller should check
     * the hasVotingRights property.
     *
     * @returns Promise<User | null> - Authenticated user or null
     */
    async requireAuthentication() {
        const authStatus = await this.checkLoginStatus();
        if (!authStatus.isLoggedIn || !authStatus.user) {
            return null;
        }
        // Verify user still exists and has current information
        try {
            const updatedUser = await this.refreshUserInfo(authStatus.user.id);
            if (updatedUser) {
                // Update session with fresh user data
                if (this.currentSession) {
                    this.currentSession.user = updatedUser;
                    this.persistSession();
                }
                return updatedUser;
            }
        }
        catch (error) {
            console.error('Error refreshing user info:', error);
            // If refresh fails, return cached user data
            return authStatus.user;
        }
        return authStatus.user;
    }
    /**
     * Redirect to login page
     *
     * Redirects the user to the login page with a return URL parameter
     * so they can be redirected back after successful authentication.
     *
     * @param returnUrl - URL to return to after login
     */
    redirectToLogin(returnUrl) {
        try {
            // Store return URL for post-login redirect
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('voting_return_url', returnUrl);
            }
            // Construct login URL with return parameter
            const loginUrl = new URL(this.config.loginPageURL, window.location.origin);
            loginUrl.searchParams.set('return', encodeURIComponent(returnUrl));
            // Perform redirect
            if (typeof window !== 'undefined') {
                window.location.href = loginUrl.toString();
            }
        }
        catch (error) {
            console.error('Error redirecting to login:', error);
            // Fallback: try direct navigation
            if (typeof window !== 'undefined') {
                window.location.href = this.config.loginPageURL;
            }
        }
    }
    /**
     * Check if user has voting permissions
     *
     * Verifies that the user not only is authenticated but also
     * has the necessary permissions to vote.
     *
     * @returns Promise<boolean> - Whether user can vote
     */
    async checkVotingPermissions() {
        const user = await this.requireAuthentication();
        return user?.hasVotingRights ?? false;
    }
    /**
     * Check if user session is valid
     *
     * Performs a comprehensive session validation including
     * expiry, activity timeout, and server-side validation.
     *
     * @returns Promise<boolean> - Whether session is valid
     */
    async isSessionValid() {
        const authStatus = await this.checkLoginStatus();
        return authStatus.isLoggedIn;
    }
    /**
     * Handle session expiry
     *
     * Called when a session expires. Clears all session data
     * and optionally redirects to login.
     *
     * @param redirectToLogin - Whether to redirect to login page
     */
    async handleSessionExpiry(redirectToLogin = false) {
        await this.clearSession();
        if (redirectToLogin && typeof window !== 'undefined') {
            this.redirectToLogin(window.location.pathname + window.location.search);
        }
    }
    /**
     * Login with credentials
     *
     * Authenticates user with provided credentials and establishes session.
     * This method integrates with the existing authentication system.
     *
     * @param credentials - Login credentials
     * @returns Promise<AuthStatus> - Authentication result
     */
    async login(credentials) {
        try {
            const response = await fetch(`${this.config.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            if (!response.ok) {
                return {
                    isLoggedIn: false
                };
            }
            const result = await response.json();
            if (result.success && result.user) {
                // Establish session
                this.currentSession = {
                    user: result.user,
                    token: result.token,
                    expiresAt: new Date(Date.now() + this.config.sessionTimeout),
                    lastActivity: new Date()
                };
                // Persist session
                this.persistSession();
                return {
                    isLoggedIn: true,
                    user: result.user,
                    sessionExpiry: this.currentSession.expiresAt
                };
            }
            return {
                isLoggedIn: false
            };
        }
        catch (error) {
            console.error('Login error:', error);
            return {
                isLoggedIn: false
            };
        }
    }
    /**
     * Logout user
     *
     * Clears session and notifies server of logout.
     */
    async logout() {
        try {
            // Notify server of logout
            if (this.currentSession?.token) {
                await fetch(`${this.config.baseURL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.currentSession.token}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
        }
        catch (error) {
            console.error('Logout server notification error:', error);
            // Continue with local cleanup even if server notification fails
        }
        await this.clearSession();
    }
    /**
     * Get current user
     *
     * Returns the currently authenticated user without requiring
     * a full authentication check.
     *
     * @returns User | null - Current user or null
     */
    getCurrentUser() {
        return this.currentSession?.user ?? null;
    }
    /**
     * Refresh user information
     *
     * Fetches updated user information from the server.
     *
     * @param userId - User ID to refresh
     * @returns Promise<User | null> - Updated user info
     */
    async refreshUserInfo(userId) {
        try {
            const response = await fetch(`${this.config.baseURL}/users/${userId}`, {
                headers: this.getAuthHeaders(),
            });
            if (!response.ok) {
                return null;
            }
            const result = await response.json();
            return result.success ? result.user : null;
        }
        catch (error) {
            console.error('Error refreshing user info:', error);
            return null;
        }
    }
    /**
     * Validate session with server
     *
     * Validates the current session with the server to ensure
     * it's still valid and the user still exists.
     *
     * @param user - User to validate
     * @returns Promise<validation result>
     */
    async validateWithServer(user) {
        try {
            const response = await fetch(`${this.config.baseURL}/auth/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!response.ok) {
                return { isValid: false };
            }
            const result = await response.json();
            if (result.success && result.user) {
                return {
                    isValid: true,
                    user: result.user,
                    token: result.token,
                    expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined
                };
            }
            return { isValid: false };
        }
        catch (error) {
            console.error('Server validation error:', error);
            return { isValid: false };
        }
    }
    /**
     * Initialize session monitoring
     *
     * Sets up periodic session validation and cleanup.
     */
    initializeSessionMonitoring() {
        // Check session every 5 minutes
        this.sessionCheckInterval = setInterval(async () => {
            if (this.currentSession) {
                const authStatus = await this.checkLoginStatus();
                if (!authStatus.isLoggedIn) {
                    await this.handleSessionExpiry();
                }
            }
        }, 5 * 60 * 1000);
    }
    /**
     * Load persisted session from storage
     */
    loadPersistedSession() {
        try {
            const persistedUser = this.loadFromStorage();
            if (persistedUser) {
                // Don't automatically restore session, just keep the data
                // Session will be validated on first checkLoginStatus call
            }
        }
        catch (error) {
            console.error('Error loading persisted session:', error);
            this.clearPersistentStorage();
        }
    }
    /**
     * Load user data from persistent storage
     */
    loadFromStorage() {
        try {
            if (typeof localStorage === 'undefined') {
                return null;
            }
            const stored = localStorage.getItem(this.config.localStorageKey);
            if (!stored) {
                return null;
            }
            const parsed = JSON.parse(stored);
            // Validate stored data structure
            if (parsed && typeof parsed === 'object' &&
                parsed.id && parsed.username && parsed.email &&
                typeof parsed.hasVotingRights === 'boolean') {
                return parsed;
            }
            return null;
        }
        catch (error) {
            console.error('Error loading from storage:', error);
            return null;
        }
    }
    /**
     * Persist current session to storage
     */
    persistSession() {
        try {
            if (!this.currentSession || typeof localStorage === 'undefined') {
                return;
            }
            // Store user data in localStorage for persistence
            localStorage.setItem(this.config.localStorageKey, JSON.stringify(this.currentSession.user));
            // Store session data in sessionStorage for current session
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(this.config.sessionStorageKey, JSON.stringify({
                    expiresAt: this.currentSession.expiresAt.toISOString(),
                    lastActivity: this.currentSession.lastActivity.toISOString()
                }));
            }
        }
        catch (error) {
            console.error('Error persisting session:', error);
        }
    }
    /**
     * Clear current session
     */
    async clearSession() {
        this.currentSession = null;
        this.clearPersistentStorage();
    }
    /**
     * Clear persistent storage
     */
    clearPersistentStorage() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(this.config.localStorageKey);
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(this.config.sessionStorageKey);
                sessionStorage.removeItem('voting_return_url');
            }
        }
        catch (error) {
            console.error('Error clearing persistent storage:', error);
        }
    }
    /**
     * Get authentication headers for API requests
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.currentSession?.token) {
            headers['Authorization'] = `Bearer ${this.currentSession.token}`;
        }
        return headers;
    }
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }
}
exports.VotingAuthenticationGuard = VotingAuthenticationGuard;
/**
 * Factory function to create authentication guard instance
 *
 * @param config - Optional configuration overrides
 * @returns AuthenticationGuard instance
 */
function createAuthenticationGuard(config) {
    return new VotingAuthenticationGuard(config);
}
/**
 * Default authentication guard instance
 *
 * Pre-configured instance for immediate use in applications.
 */
exports.authGuard = createAuthenticationGuard();
/**
 * Utility functions for authentication state management
 */
exports.AuthUtils = {
    /**
     * Check if user is authenticated (convenience function)
     */
    async isAuthenticated() {
        const status = await exports.authGuard.checkLoginStatus();
        return status.isLoggedIn;
    },
    /**
     * Get current user (convenience function)
     */
    getCurrentUser() {
        return exports.authGuard.getCurrentUser();
    },
    /**
     * Require authentication with automatic redirect
     */
    async requireAuthWithRedirect(returnUrl) {
        const user = await exports.authGuard.requireAuthentication();
        if (!user) {
            exports.authGuard.redirectToLogin(returnUrl || window.location.href);
            return null;
        }
        return user;
    },
    /**
     * Check voting permissions with user-friendly error
     */
    async checkVotingPermissions() {
        const user = await exports.authGuard.requireAuthentication();
        if (!user) {
            return {
                canVote: false,
                reason: qr_code_voting_1.ERROR_MESSAGES.AUTHENTICATION_REQUIRED
            };
        }
        if (!user.hasVotingRights) {
            return {
                canVote: false,
                reason: qr_code_voting_1.ERROR_MESSAGES.VOTING_PERMISSION_DENIED
            };
        }
        return { canVote: true };
    }
};
//# sourceMappingURL=authentication-guard.js.map