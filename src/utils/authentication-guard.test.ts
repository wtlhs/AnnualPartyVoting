/**
 * Unit tests for AuthenticationGuard
 * 
 * Tests the authentication state checking, session validation,
 * and voting permission verification functionality.
 */

import { VotingAuthenticationGuard, createAuthenticationGuard, AuthUtils } from './authentication-guard';
import { User } from '../types/qr-code-voting';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/vote?candidate_id=123',
    origin: 'http://localhost:3000',
    pathname: '/vote',
    search: '?candidate_id=123',
  },
  writable: true,
});

// Mock user data
const mockUser: User = {
  id: 'user123',
  username: 'testuser',
  email: 'test@example.com',
  hasVotingRights: true,
};

describe('VotingAuthenticationGuard', () => {
  let authGuard: VotingAuthenticationGuard;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.getItem.mockReturnValue(null);

    // Create fresh instance
    authGuard = new VotingAuthenticationGuard({
      baseURL: '/api',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
    });
  });

  afterEach(() => {
    authGuard.destroy();
  });

  describe('checkLoginStatus', () => {
    it('should return not logged in when no session exists', async () => {
      const status = await authGuard.checkLoginStatus();
      
      expect(status.isLoggedIn).toBe(false);
      expect(status.user).toBeUndefined();
    });

    it('should return logged in status for valid session', async () => {
      // Mock successful login first
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
          token: 'valid-token',
        }),
      });

      const loginStatus = await authGuard.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(loginStatus.isLoggedIn).toBe(true);
      expect(loginStatus.user).toEqual(mockUser);

      // Now check login status
      const status = await authGuard.checkLoginStatus();
      expect(status.isLoggedIn).toBe(true);
      expect(status.user).toEqual(mockUser);
    });

    it('should handle expired sessions', async () => {
      // Create an expired session
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'expired-token',
        expiresAt: expiredDate,
        lastActivity: new Date(),
      };

      const status = await authGuard.checkLoginStatus();
      
      expect(status.isLoggedIn).toBe(false);
      expect(status.sessionExpiry).toEqual(expiredDate);
    });

    it('should handle session timeout due to inactivity', async () => {
      // Create a session with old last activity
      const oldActivity = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'inactive-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        lastActivity: oldActivity,
      };

      const status = await authGuard.checkLoginStatus();
      
      expect(status.isLoggedIn).toBe(false);
    });

    it('should validate persisted session with server', async () => {
      // Mock persisted user data
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      // Mock server validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
          token: 'validated-token',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      });

      const status = await authGuard.checkLoginStatus();
      
      expect(status.isLoggedIn).toBe(true);
      expect(status.user).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/validate', expect.any(Object));
    });

    it('should clear invalid persisted session', async () => {
      // Mock persisted user data
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      // Mock server validation failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
        }),
      });

      const status = await authGuard.checkLoginStatus();
      
      expect(status.isLoggedIn).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('requireAuthentication', () => {
    it('should return null when user is not authenticated', async () => {
      const user = await authGuard.requireAuthentication();
      expect(user).toBeNull();
    });

    it('should return user when authenticated', async () => {
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      // Mock user refresh
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const user = await authGuard.requireAuthentication();
      expect(user).toEqual(mockUser);
    });

    it('should refresh user information', async () => {
      const updatedUser = { ...mockUser, hasVotingRights: false };
      
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      // Mock user refresh with updated data
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: updatedUser,
        }),
      });

      const user = await authGuard.requireAuthentication();
      expect(user).toEqual(updatedUser);
      expect((authGuard as any).currentSession.user).toEqual(updatedUser);
    });

    it('should handle user refresh failure gracefully', async () => {
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      // Mock user refresh failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const user = await authGuard.requireAuthentication();
      expect(user).toEqual(mockUser); // Should return cached user
    });
  });

  describe('redirectToLogin', () => {
    it('should redirect to login page with return URL', () => {
      const returnUrl = '/vote?candidate_id=123';
      
      authGuard.redirectToLogin(returnUrl);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'voting_return_url',
        returnUrl
      );
      expect(window.location.href).toBe('/login?return=%2Fvote%3Fcandidate_id%3D123');
    });

    it('should handle redirect errors gracefully', () => {
      // Mock sessionStorage error
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const returnUrl = '/vote?candidate_id=123';
      
      // Should not throw
      expect(() => authGuard.redirectToLogin(returnUrl)).not.toThrow();
    });
  });

  describe('checkVotingPermissions', () => {
    it('should return false when user is not authenticated', async () => {
      const canVote = await authGuard.checkVotingPermissions();
      expect(canVote).toBe(false);
    });

    it('should return true when user has voting rights', async () => {
      // Set up authenticated session with voting rights
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      // Mock user refresh
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const canVote = await authGuard.checkVotingPermissions();
      expect(canVote).toBe(true);
    });

    it('should return false when user lacks voting rights', async () => {
      const userWithoutRights = { ...mockUser, hasVotingRights: false };
      
      // Set up authenticated session without voting rights
      (authGuard as any).currentSession = {
        user: userWithoutRights,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      // Mock user refresh
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: userWithoutRights,
        }),
      });

      const canVote = await authGuard.checkVotingPermissions();
      expect(canVote).toBe(false);
    });
  });

  describe('login', () => {
    it('should successfully authenticate user', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
          token: 'auth-token',
        }),
      });

      const credentials = { username: 'testuser', password: 'password123' };
      const result = await authGuard.login(credentials);

      expect(result.isLoggedIn).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    });

    it('should handle login failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const credentials = { username: 'testuser', password: 'wrongpassword' };
      const result = await authGuard.login(credentials);

      expect(result.isLoggedIn).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const credentials = { username: 'testuser', password: 'password123' };
      const result = await authGuard.login(credentials);

      expect(result.isLoggedIn).toBe(false);
    });
  });

  describe('logout', () => {
    it('should notify server and clear session', async () => {
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'auth-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authGuard.logout();

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer auth-token',
          'Content-Type': 'application/json',
        },
      });

      expect((authGuard as any).currentSession).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });

    it('should clear session even if server notification fails', async () => {
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'auth-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await authGuard.logout();

      expect((authGuard as any).currentSession).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no session exists', () => {
      const user = authGuard.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return current user when session exists', () => {
      // Set up authenticated session
      (authGuard as any).currentSession = {
        user: mockUser,
        token: 'auth-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        lastActivity: new Date(),
      };

      const user = authGuard.getCurrentUser();
      expect(user).toEqual(mockUser);
    });
  });

  describe('session persistence', () => {
    it('should persist session data to storage', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
          token: 'auth-token',
        }),
      });

      await authGuard.login({ username: 'testuser', password: 'password123' });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'voting_user',
        JSON.stringify(mockUser)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'voting_session',
        expect.stringContaining('expiresAt')
      );
    });

    it('should load persisted session data', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      const newAuthGuard = new VotingAuthenticationGuard();
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('voting_user');
      
      newAuthGuard.destroy();
    });

    it('should handle corrupted storage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      // Should not throw
      expect(() => new VotingAuthenticationGuard()).not.toThrow();
    });
  });
});

describe('createAuthenticationGuard', () => {
  it('should create authentication guard with default config', () => {
    const guard = createAuthenticationGuard();
    expect(guard).toBeInstanceOf(VotingAuthenticationGuard);
  });

  it('should create authentication guard with custom config', () => {
    const config = { baseURL: '/custom-api' };
    const guard = createAuthenticationGuard(config);
    expect(guard).toBeInstanceOf(VotingAuthenticationGuard);
  });
});

describe('AuthUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAuthenticated', () => {
    it('should return authentication status', async () => {
      // Mock the default auth guard
      const mockCheckLoginStatus = jest.fn().mockResolvedValue({ isLoggedIn: true });
      (AuthUtils as any).authGuard = { checkLoginStatus: mockCheckLoginStatus };

      const isAuth = await AuthUtils.isAuthenticated();
      expect(isAuth).toBe(true);
    });
  });

  describe('checkVotingPermissions', () => {
    it('should return permission status with reason', async () => {
      const mockUserWithoutRights = { ...mockUser, hasVotingRights: false };
      const mockRequireAuth = jest.fn().mockResolvedValue(mockUserWithoutRights);
      (AuthUtils as any).authGuard = { requireAuthentication: mockRequireAuth };

      const result = await AuthUtils.checkVotingPermissions();
      
      expect(result.canVote).toBe(false);
      expect(result.reason).toBe('Voting permission denied');
    });

    it('should return can vote when user has permissions', async () => {
      const mockRequireAuth = jest.fn().mockResolvedValue(mockUser);
      (AuthUtils as any).authGuard = { requireAuthentication: mockRequireAuth };

      const result = await AuthUtils.checkVotingPermissions();
      
      expect(result.canVote).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});