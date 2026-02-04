const { 
  requireAdmin, 
  authenticateLogin, 
  validateSession, 
  destroySession,
  getSessionStats,
  cleanupExpiredSessions 
} = require('./adminAuth');

describe('Admin Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;
  
  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });
  
  describe('authenticateLogin', () => {
    test('should authenticate with correct password', () => {
      const result = authenticateLogin('admin123');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.adminId).toBe('admin');
    });
    
    test('should reject incorrect password', () => {
      const result = authenticateLogin('wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_PASSWORD');
    });
    
    test('should reject empty password', () => {
      const result = authenticateLogin('');
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_PASSWORD');
    });
  });
  
  describe('validateSession', () => {
    test('should validate active session', () => {
      const loginResult = authenticateLogin('admin123');
      const validation = validateSession(loginResult.token);
      
      expect(validation.valid).toBe(true);
      expect(validation.session).toBeDefined();
      expect(validation.session.adminId).toBe('admin');
    });
    
    test('should reject invalid token', () => {
      const validation = validateSession('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('SESSION_NOT_FOUND');
    });
    
    test('should reject expired session', async () => {
      // 创建一个会话
      const loginResult = authenticateLogin('admin123');
      
      // 手动设置过期时间为过去
      const sessions = require('./adminAuth').__sessions || new Map();
      if (sessions.has && sessions.has(loginResult.token)) {
        const session = sessions.get(loginResult.token);
        session.expiresAt = new Date(Date.now() - 1000); // 1秒前过期
      }
      
      const validation = validateSession(loginResult.token);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('SESSION_EXPIRED');
    });
  });
  
  describe('requireAdmin middleware', () => {
    test('should reject request without authorization header', () => {
      requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: '需要管理员权限',
        requiresAuth: true
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should reject request with invalid authorization format', () => {
      mockReq.headers.authorization = 'InvalidFormat token';
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should reject request with invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        errorCode: 'SESSION_NOT_FOUND',
        message: '会话不存在，请重新登录',
        requiresAuth: true
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should allow request with valid token', () => {
      const loginResult = authenticateLogin('admin123');
      mockReq.headers.authorization = `Bearer ${loginResult.token}`;
      
      requireAdmin(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.adminSession).toBeDefined();
      expect(mockReq.adminId).toBe('admin');
    });
  });
  
  describe('session management', () => {
    test('should destroy session', () => {
      const loginResult = authenticateLogin('admin123');
      const destroyed = destroySession(loginResult.token);
      
      expect(destroyed).toBe(true);
      
      // 验证会话已被销毁
      const validation = validateSession(loginResult.token);
      expect(validation.valid).toBe(false);
    });
    
    test('should get session statistics', () => {
      // 创建几个会话
      authenticateLogin('admin123');
      authenticateLogin('admin123');
      
      const stats = getSessionStats();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('expired');
      expect(stats).toHaveProperty('maxSessions');
      expect(stats).toHaveProperty('sessionTimeout');
      expect(stats.total).toBeGreaterThan(0);
    });
    
    test('should cleanup expired sessions', () => {
      const cleanedCount = cleanupExpiredSessions();
      
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });
});