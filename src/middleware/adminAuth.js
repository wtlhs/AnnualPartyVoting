const crypto = require('crypto');

// 简单的内存会话存储（生产环境应使用Redis或数据库）
const sessions = new Map();

// 会话配置
const SESSION_CONFIG = {
  // 会话超时时间（毫秒）- 30分钟
  TIMEOUT: parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 30 * 60 * 1000,
  // 清理间隔（毫秒）- 5分钟
  CLEANUP_INTERVAL: 5 * 60 * 1000,
  // 最大会话数
  MAX_SESSIONS: 10
};

// 管理员密码
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * 生成会话令牌
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 创建新会话
 */
function createSession(adminId = 'admin') {
  // 清理过期会话
  cleanupExpiredSessions();
  
  // 检查会话数量限制
  if (sessions.size >= SESSION_CONFIG.MAX_SESSIONS) {
    // 删除最旧的会话
    const oldestToken = Array.from(sessions.keys())[0];
    sessions.delete(oldestToken);
  }
  
  const token = generateSessionToken();
  const session = {
    adminId,
    createdAt: new Date(),
    lastAccessAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_CONFIG.TIMEOUT),
    ipAddress: null,
    userAgent: null
  };
  
  sessions.set(token, session);
  return { token, session };
}

/**
 * 验证会话
 */
function validateSession(token, req = null) {
  if (!token || !sessions.has(token)) {
    return { valid: false, reason: 'SESSION_NOT_FOUND' };
  }
  
  const session = sessions.get(token);
  const now = new Date();
  
  // 检查会话是否过期
  if (now > session.expiresAt) {
    sessions.delete(token);
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }
  
  // 更新最后访问时间和过期时间
  session.lastAccessAt = now;
  session.expiresAt = new Date(Date.now() + SESSION_CONFIG.TIMEOUT);
  
  // 更新IP和User-Agent（用于安全检查）
  if (req) {
    const currentIp = req.ip || req.connection.remoteAddress;
    const currentUserAgent = req.get('User-Agent');
    
    // 首次设置IP和User-Agent
    if (!session.ipAddress) {
      session.ipAddress = currentIp;
      session.userAgent = currentUserAgent;
    }
    // 检查IP和User-Agent是否发生变化（简单的安全检查）
    else if (session.ipAddress !== currentIp || session.userAgent !== currentUserAgent) {
      // 记录可疑活动
      console.warn('Suspicious session activity detected:', {
        token: token.substring(0, 8) + '...',
        originalIp: session.ipAddress,
        currentIp,
        originalUserAgent: session.userAgent,
        currentUserAgent
      });
      
      // 可以选择是否因为IP/UA变化而使会话失效
      // 这里我们记录但不使会话失效，因为用户可能在不同网络间切换
    }
  }
  
  return { 
    valid: true, 
    session: {
      ...session,
      remainingTime: session.expiresAt - now
    }
  };
}

/**
 * 销毁会话
 */
function destroySession(token) {
  return sessions.delete(token);
}

/**
 * 清理过期会话
 */
function cleanupExpiredSessions() {
  const now = new Date();
  const expiredTokens = [];
  
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      expiredTokens.push(token);
    }
  }
  
  expiredTokens.forEach(token => sessions.delete(token));
  
  if (expiredTokens.length > 0) {
    console.log(`Cleaned up ${expiredTokens.length} expired admin sessions`);
  }
  
  return expiredTokens.length;
}

/**
 * 获取会话统计信息
 */
function getSessionStats() {
  const now = new Date();
  let activeSessions = 0;
  let expiredSessions = 0;
  
  for (const session of sessions.values()) {
    if (now > session.expiresAt) {
      expiredSessions++;
    } else {
      activeSessions++;
    }
  }
  
  return {
    total: sessions.size,
    active: activeSessions,
    expired: expiredSessions,
    maxSessions: SESSION_CONFIG.MAX_SESSIONS,
    sessionTimeout: SESSION_CONFIG.TIMEOUT
  };
}

/**
 * 管理员登录验证
 */
function authenticateLogin(password, req = null) {
  if (!password || password !== ADMIN_PASSWORD) {
    return { success: false, reason: 'INVALID_PASSWORD' };
  }
  
  const { token, session } = createSession();
  
  // 设置请求信息
  if (req) {
    session.ipAddress = req.ip || req.connection.remoteAddress;
    session.userAgent = req.get('User-Agent');
  }
  
  return {
    success: true,
    token,
    session: {
      adminId: session.adminId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      remainingTime: session.expiresAt - session.createdAt
    }
  };
}

/**
 * 管理员权限验证中间件
 */
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '需要管理员权限',
      requiresAuth: true
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const validation = validateSession(token, req);
  
  if (!validation.valid) {
    let message = '认证失败';
    let errorCode = 'AUTH_FAILED';
    
    switch (validation.reason) {
      case 'SESSION_NOT_FOUND':
        message = '会话不存在，请重新登录';
        errorCode = 'SESSION_NOT_FOUND';
        break;
      case 'SESSION_EXPIRED':
        message = '会话已过期，请重新登录';
        errorCode = 'SESSION_EXPIRED';
        break;
    }
    
    return res.status(401).json({
      success: false,
      errorCode,
      message,
      requiresAuth: true
    });
  }
  
  // 将会话信息添加到请求对象
  req.adminSession = validation.session;
  req.adminId = validation.session.adminId;
  
  next();
}

/**
 * 可选的管理员权限验证中间件（不强制要求认证）
 */
function optionalAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const validation = validateSession(token, req);
    
    if (validation.valid) {
      req.adminSession = validation.session;
      req.adminId = validation.session.adminId;
      req.isAdmin = true;
    }
  }
  
  next();
}

// 启动定期清理任务
const cleanupInterval = setInterval(() => {
  cleanupExpiredSessions();
}, SESSION_CONFIG.CLEANUP_INTERVAL);

// 优雅关闭时清理定时器
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

module.exports = {
  requireAdmin,
  optionalAdmin,
  authenticateLogin,
  createSession,
  validateSession,
  destroySession,
  cleanupExpiredSessions,
  getSessionStats,
  SESSION_CONFIG
};