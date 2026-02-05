/**
 * Persistent Session Manager
 *
 * Manages user session with multi-layer storage strategy:
 * 1. localStorage (persistent storage)
 * 2. sessionStorage (session-level storage)
 * 3. Cookie (last resort, 7-day expiry)
 * 4. Server-side auto-login (device fingerprint based)
 *
 * This ensures login state persists even when browser clears storage
 * (common in WeChat and other mobile browsers).
 */

class SessionManager {
    constructor() {
        this.storageKeys = {
            USER_ID: 'annual_party_user_id',
            USER_NAME: 'annual_party_user_name',
            USER_GENDER: 'annual_party_user_gender',
            NUMERIC_ID: 'annual_party_numeric_id',
            REGISTRATION_TIME: 'annual_party_registration_time',
            PENDING_RETURN_URL: 'pending_return_url',
            VOTE_INTENT_TIMESTAMP: 'vote_intent_timestamp',
            REREGISTER_FLAG: 'annual_party_reregister_flag' // 标记正在重新注册
        };

        this.cookieName = 'annual_party_session';
        this.cookieExpiryDays = 7;
        this.autoLoginApiUrl = '/api/users/auth/auto-login';
    }

    /**
     * Save user session to all storage layers
     * @param {Object} userData - User data to save
     * @param {string} userData.userId - User ID
     * @param {string} userData.name - User name
     * @param {string} userData.gender - User gender
     * @param {string} userData.numericId - Numeric ID
     */
    saveSession(userData) {
        const sessionData = {
            userId: userData.userId,
            name: userData.name,
            gender: userData.gender,
            numericId: userData.numericId,
            registrationTime: new Date().toISOString()
        };

        const dataStr = JSON.stringify(sessionData);

        // 1. Save to localStorage (primary storage)
        try {
            localStorage.setItem(this.storageKeys.USER_ID, sessionData.userId);
            localStorage.setItem(this.storageKeys.USER_NAME, sessionData.name);
            localStorage.setItem(this.storageKeys.USER_GENDER, sessionData.gender);
            localStorage.setItem(this.storageKeys.NUMERIC_ID, sessionData.numericId || '');
            localStorage.setItem(this.storageKeys.REGISTRATION_TIME, sessionData.registrationTime);
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }

        // 2. Save to sessionStorage (backup)
        try {
            sessionStorage.setItem(this.storageKeys.USER_ID, sessionData.userId);
            sessionStorage.setItem(this.storageKeys.USER_NAME, sessionData.name);
            sessionStorage.setItem(this.storageKeys.USER_GENDER, sessionData.gender);
            sessionStorage.setItem(this.storageKeys.NUMERIC_ID, sessionData.numericId || '');
            sessionStorage.setItem(this.storageKeys.REGISTRATION_TIME, sessionData.registrationTime);
        } catch (error) {
            console.warn('Failed to save to sessionStorage:', error);
        }

        // 3. Save to Cookie (last resort)
        try {
            this.setCookie(this.cookieName, dataStr, this.cookieExpiryDays);
        } catch (error) {
            console.warn('Failed to save to Cookie:', error);
        }
    }

    /**
     * Restore user session from any available storage
     * @returns {Promise<Object|null>} User session data or null if not found
     */
    async restoreSession() {
        // 检查是否正在重新注册（如果是，跳过自动登录）
        if (this.isReregistering()) {
            console.log('⊘ Skipping session restore - user is re-registering');
            return null;
        }

        // 1. Try localStorage first
        let session = this.getSessionFromLocalStorage();
        if (session) {
            console.log('✓ Session restored from localStorage');
            return session;
        }

        // 2. Try sessionStorage
        session = this.getSessionFromSessionStorage();
        if (session) {
            console.log('✓ Session restored from sessionStorage');
            // Replicate to other storage layers
            this.saveSession(session);
            return session;
        }

        // 3. Try Cookie
        session = this.getSessionFromCookie();
        if (session) {
            console.log('✓ Session restored from Cookie');
            // Replicate to other storage layers
            this.saveSession(session);
            return session;
        }

        // 4. Only try server-side auto-login if we found some local session traces
        // This prevents unnecessary API calls for completely new users
        const hasLocalTraces = this.hasAnySessionTraces();
        if (!hasLocalTraces) {
            console.log('✗ No session traces found, skipping server auto-login');
            return null;
        }

        // 5. Try server-side auto-login (device fingerprint)
        try {
            console.log('Attempting server-side auto-login...');
            const response = await fetch(this.autoLoginApiUrl);
            const result = await response.json();

            if (result.success && result.user) {
                console.log('✓ Session restored from server (device fingerprint)');
                const session = {
                    userId: result.user.userId,
                    name: result.user.name,
                    gender: result.user.gender,
                    numericId: result.user.numericId,
                    registrationTime: result.user.registrationTime
                };
                // Save to all storage layers
                this.saveSession(session);
                return session;
            }
        } catch (error) {
            // Silently fail - don't show errors for new users
            console.debug('Server-side auto-login not available:', error.message);
        }

        console.log('✗ No session found in any storage');
        return null;
    }

    /**
     * Get session from localStorage
     * @returns {Object|null} Session data or null
     */
    getSessionFromLocalStorage() {
        try {
            const userId = localStorage.getItem(this.storageKeys.USER_ID);
            const userName = localStorage.getItem(this.storageKeys.USER_NAME);
            const userGender = localStorage.getItem(this.storageKeys.USER_GENDER);
            const numericId = localStorage.getItem(this.storageKeys.NUMERIC_ID);
            const registrationTime = localStorage.getItem(this.storageKeys.REGISTRATION_TIME);

            if (userId && userName && userGender && registrationTime) {
                // Check if registration is still valid (within 30 days)
                if (this.isRegistrationValid(registrationTime)) {
                    return {
                        userId,
                        name: userName,
                        gender: userGender,
                        numericId: numericId || '',
                        registrationTime
                    };
                }
            }
        } catch (error) {
            console.warn('Error reading from localStorage:', error);
        }
        return null;
    }

    /**
     * Get session from sessionStorage
     * @returns {Object|null} Session data or null
     */
    getSessionFromSessionStorage() {
        try {
            const userId = sessionStorage.getItem(this.storageKeys.USER_ID);
            const userName = sessionStorage.getItem(this.storageKeys.USER_NAME);
            const userGender = sessionStorage.getItem(this.storageKeys.USER_GENDER);
            const numericId = sessionStorage.getItem(this.storageKeys.NUMERIC_ID);
            const registrationTime = sessionStorage.getItem(this.storageKeys.REGISTRATION_TIME);

            if (userId && userName && userGender && registrationTime) {
                if (this.isRegistrationValid(registrationTime)) {
                    return {
                        userId,
                        name: userName,
                        gender: userGender,
                        numericId: numericId || '',
                        registrationTime
                    };
                }
            }
        } catch (error) {
            console.warn('Error reading from sessionStorage:', error);
        }
        return null;
    }

    /**
     * Get session from Cookie
     * @returns {Object|null} Session data or null
     */
    getSessionFromCookie() {
        try {
            const cookieValue = this.getCookie(this.cookieName);
            if (cookieValue) {
                const session = JSON.parse(decodeURIComponent(cookieValue));
                if (session.userId && session.name && session.registrationTime) {
                    if (this.isRegistrationValid(session.registrationTime)) {
                        return session;
                    }
                }
            }
        } catch (error) {
            console.warn('Error reading from Cookie:', error);
        }
        return null;
    }

    /**
     * Clear session from all storage layers
     * @param {boolean} isReregistering - Whether user is re-registering (sets flag to skip auto-login)
     */
    clearSession(isReregistering = false) {
        // If re-registering, set a flag FIRST (before clearing)
        // to prevent race condition where flag gets cleared immediately
        if (isReregistering) {
            try {
                const flagExpiry = Date.now() + 60000; // 1分钟后过期
                localStorage.setItem(this.storageKeys.REREGISTER_FLAG, flagExpiry.toString());
                sessionStorage.setItem(this.storageKeys.REREGISTER_FLAG, flagExpiry.toString());
                console.log('✓ Set re-register flag to prevent auto-login');
            } catch (error) {
                console.warn('Error setting re-register flag:', error);
            }
        }

        // Clear localStorage (but preserve REREGISTER_FLAG if re-registering)
        try {
            Object.values(this.storageKeys).forEach(key => {
                // Skip the re-register flag if we're in the process of re-registering
                if (isReregistering && key === this.storageKeys.REREGISTER_FLAG) {
                    return;
                }
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }

        // Clear sessionStorage (but preserve REREGISTER_FLAG if re-registering)
        try {
            Object.values(this.storageKeys).forEach(key => {
                // Skip the re-register flag if we're in the process of re-registering
                if (isReregistering && key === this.storageKeys.REREGISTER_FLAG) {
                    return;
                }
                sessionStorage.removeItem(key);
            });
        } catch (error) {
            console.warn('Error clearing sessionStorage:', error);
        }

        // Clear Cookie
        try {
            this.deleteCookie(this.cookieName);
        } catch (error) {
            console.warn('Error clearing Cookie:', error);
        }
    }

    /**
     * Check if registration is still valid (within 30 days)
     * @param {string} registrationTime - Registration timestamp
     * @returns {boolean} True if valid
     */
    isRegistrationValid(registrationTime) {
        if (!registrationTime) return false;

        const regTime = new Date(registrationTime);
        const now = new Date();
        const daysDiff = (now - regTime) / (1000 * 60 * 60 * 24);

        return daysDiff < 30; // 30 days validity
    }

    /**
     * Set a cookie
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {number} days - Expiry in days
     */
    setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`;
    }

    /**
     * Get a cookie value
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null
     */
    getCookie(name) {
        const nameEQ = `${name}=`;
        const cookies = document.cookie.split(';');

        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1, cookie.length);
            }
            if (cookie.indexOf(nameEQ) === 0) {
                return cookie.substring(nameEQ.length, cookie.length);
            }
        }
        return null;
    }

    /**
     * Delete a cookie
     * @param {string} name - Cookie name
     */
    deleteCookie(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }

    /**
     * Check if user has any pending return URL (for post-registration redirect)
     * @returns {Object|null} Return URL info or null
     */
    getPendingReturnUrl() {
        const returnUrl = localStorage.getItem(this.storageKeys.PENDING_RETURN_URL);
        const timestamp = localStorage.getItem(this.storageKeys.VOTE_INTENT_TIMESTAMP);

        if (returnUrl && timestamp) {
            if (this.isVoteIntentValid(timestamp)) {
                return { returnUrl, timestamp };
            }
        }
        return null;
    }

    /**
     * Clear pending return URL
     */
    clearPendingReturnUrl() {
        localStorage.removeItem(this.storageKeys.PENDING_RETURN_URL);
        localStorage.removeItem(this.storageKeys.VOTE_INTENT_TIMESTAMP);
    }

    /**
     * Check if vote intent is valid (within 24 hours)
     * @param {string} timestamp - Vote intent timestamp
     * @returns {boolean} True if valid
     */
    isVoteIntentValid(timestamp) {
        if (!timestamp) return false;

        const intentTime = new Date(timestamp);
        const now = new Date();
        const hoursDiff = (now - intentTime) / (1000 * 60 * 60);

        return hoursDiff < 24;
    }

    /**
     * Save pending return URL
     * @param {string} returnUrl - URL to return to after registration
     */
    savePendingReturnUrl(returnUrl) {
        localStorage.setItem(this.storageKeys.PENDING_RETURN_URL, returnUrl);
        localStorage.setItem(this.storageKeys.VOTE_INTENT_TIMESTAMP, new Date().toISOString());
    }

    /**
     * Check if user is currently re-registering (flag exists and not expired)
     * @returns {boolean} True if re-registering
     */
    isReregistering() {
        try {
            const flagStr = localStorage.getItem(this.storageKeys.REREGISTER_FLAG) ||
                          sessionStorage.getItem(this.storageKeys.REREGISTER_FLAG);

            if (!flagStr) {
                return false;
            }

            const flagExpiry = parseInt(flagStr, 10);
            const now = Date.now();

            // Check if flag is expired (more than 1 minute)
            if (now > flagExpiry) {
                // Clear expired flag
                localStorage.removeItem(this.storageKeys.REREGISTER_FLAG);
                sessionStorage.removeItem(this.storageKeys.REREGISTER_FLAG);
                return false;
            }

            return true;
        } catch (error) {
            console.warn('Error checking re-register flag:', error);
            return false;
        }
    }

    /**
     * Clear the re-register flag (called after successful registration)
     */
    clearReregisterFlag() {
        try {
            localStorage.removeItem(this.storageKeys.REREGISTER_FLAG);
            sessionStorage.removeItem(this.storageKeys.REREGISTER_FLAG);
            console.log('✓ Cleared re-register flag');
        } catch (error) {
            console.warn('Error clearing re-register flag:', error);
        }
    }

    /**
     * Check if there are any session traces in local storage
     * This helps determine if we should try server-side auto-login
     * @returns {boolean} True if any session traces exist
     */
    hasAnySessionTraces() {
        try {
            // Check for any user-related data (excluding the re-register flag)
            const traces = [
                this.storageKeys.USER_ID,
                this.storageKeys.USER_NAME,
                this.storageKeys.USER_GENDER,
                this.storageKeys.NUMERIC_ID,
                this.storageKeys.REGISTRATION_TIME
            ];

            for (const key of traces) {
                if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
                    return true;
                }
            }

            // Also check the session cookie
            if (this.getCookie(this.cookieName)) {
                return true;
            }

            return false;
        } catch (error) {
            console.warn('Error checking session traces:', error);
            return false;
        }
    }
}

// Export singleton instance
const sessionManager = new SessionManager();
