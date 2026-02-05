/**
 * Authentication Guard Implementation
 *
 * This module implements the AuthenticationGuard interface from the design document.
 * It provides user login status checking, session validation, and voting permission verification.
 *
 * Requirements: 3.1, 3.4
 * Design: AuthenticationGuard interface
 */
import { AuthenticationGuard, AuthStatus, User } from '../types/qr-code-voting';
/**
 * Configuration for authentication guard
 */
interface AuthGuardConfig {
    /** Base URL for authentication endpoints */
    baseURL: string;
    /** Session storage key */
    sessionStorageKey: string;
    /** Local storage key for persistent login */
    localStorageKey: string;
    /** Login page URL */
    loginPageURL: string;
    /** Registration page URL */
    registrationPageURL: string;
    /** Session timeout in milliseconds */
    sessionTimeout: number;
}
/**
 * Authentication Guard implementation
 *
 * Provides comprehensive authentication state management for the voting system.
 * Integrates with existing user authentication infrastructure while providing
 * QR code voting specific functionality.
 */
export declare class VotingAuthenticationGuard implements AuthenticationGuard {
    private config;
    private currentSession;
    private sessionCheckInterval;
    constructor(config?: Partial<AuthGuardConfig>);
    /**
     * Check current user login status
     *
     * This method checks both in-memory session and persistent storage
     * to determine the user's current authentication status.
     *
     * @returns Promise<AuthStatus> - Current authentication status
     */
    checkLoginStatus(): Promise<AuthStatus>;
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
    requireAuthentication(): Promise<User | null>;
    /**
     * Redirect to login page
     *
     * Redirects the user to the login page with a return URL parameter
     * so they can be redirected back after successful authentication.
     *
     * @param returnUrl - URL to return to after login
     */
    redirectToLogin(returnUrl: string): void;
    /**
     * Check if user has voting permissions
     *
     * Verifies that the user not only is authenticated but also
     * has the necessary permissions to vote.
     *
     * @returns Promise<boolean> - Whether user can vote
     */
    checkVotingPermissions(): Promise<boolean>;
    /**
     * Check if user session is valid
     *
     * Performs a comprehensive session validation including
     * expiry, activity timeout, and server-side validation.
     *
     * @returns Promise<boolean> - Whether session is valid
     */
    isSessionValid(): Promise<boolean>;
    /**
     * Handle session expiry
     *
     * Called when a session expires. Clears all session data
     * and optionally redirects to login.
     *
     * @param redirectToLogin - Whether to redirect to login page
     */
    handleSessionExpiry(redirectToLogin?: boolean): Promise<void>;
    /**
     * Login with credentials
     *
     * Authenticates user with provided credentials and establishes session.
     * This method integrates with the existing authentication system.
     *
     * @param credentials - Login credentials
     * @returns Promise<AuthStatus> - Authentication result
     */
    login(credentials: {
        username: string;
        password: string;
    }): Promise<AuthStatus>;
    /**
     * Logout user
     *
     * Clears session and notifies server of logout.
     */
    logout(): Promise<void>;
    /**
     * Get current user
     *
     * Returns the currently authenticated user without requiring
     * a full authentication check.
     *
     * @returns User | null - Current user or null
     */
    getCurrentUser(): User | null;
    /**
     * Refresh user information
     *
     * Fetches updated user information from the server.
     *
     * @param userId - User ID to refresh
     * @returns Promise<User | null> - Updated user info
     */
    private refreshUserInfo;
    /**
     * Validate session with server
     *
     * Validates the current session with the server to ensure
     * it's still valid and the user still exists.
     *
     * @param user - User to validate
     * @returns Promise<validation result>
     */
    private validateWithServer;
    /**
     * Initialize session monitoring
     *
     * Sets up periodic session validation and cleanup.
     */
    private initializeSessionMonitoring;
    /**
     * Load persisted session from storage
     */
    private loadPersistedSession;
    /**
     * Load user data from persistent storage
     */
    private loadFromStorage;
    /**
     * Persist current session to storage
     */
    private persistSession;
    /**
     * Clear current session
     */
    private clearSession;
    /**
     * Clear persistent storage
     */
    private clearPersistentStorage;
    /**
     * Get authentication headers for API requests
     */
    private getAuthHeaders;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
/**
 * Factory function to create authentication guard instance
 *
 * @param config - Optional configuration overrides
 * @returns AuthenticationGuard instance
 */
export declare function createAuthenticationGuard(config?: Partial<AuthGuardConfig>): AuthenticationGuard;
/**
 * Default authentication guard instance
 *
 * Pre-configured instance for immediate use in applications.
 */
export declare const authGuard: AuthenticationGuard;
/**
 * Utility functions for authentication state management
 */
export declare const AuthUtils: {
    /**
     * Check if user is authenticated (convenience function)
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Get current user (convenience function)
     */
    getCurrentUser(): User | null;
    /**
     * Require authentication with automatic redirect
     */
    requireAuthWithRedirect(returnUrl?: string): Promise<User | null>;
    /**
     * Check voting permissions with user-friendly error
     */
    checkVotingPermissions(): Promise<{
        canVote: boolean;
        reason?: string;
    }>;
};
export {};
//# sourceMappingURL=authentication-guard.d.ts.map