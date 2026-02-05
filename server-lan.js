const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');

// Import database initialization
const { initializeDatabase } = require('./src/database/init');

// Import routes
const userRoutes = require('./src/routes/users');
const voteRoutes = require('./src/routes/votes');
const adminRoutes = require('./src/routes/admin');
const pageRoutes = require('./src/routes/pages');

const app = express();

// Trust proxy to get real IP addresses (useful when behind reverse proxy)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// 局域网优化的安全中间件 - 完全禁用可能导致SSL错误的策略
app.use(helmet({
  contentSecurityPolicy: false, // 完全禁用CSP
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  originAgentCluster: false,
  hsts: false, // 禁用HSTS，避免HTTPS强制
  noSniff: false, // 禁用X-Content-Type-Options
  xssFilter: false, // 禁用X-XSS-Protection
  referrerPolicy: false, // 禁用Referrer-Policy
  permittedCrossDomainPolicies: false, // 禁用X-Permitted-Cross-Domain-Policies
  frameguard: false // 完全禁用X-Frame-Options
}));

// 添加强制HTTP头，防止浏览器升级到HTTPS
app.use((req, res, next) => {
  // 移除可能导致HTTPS升级的头
  res.removeHeader('Strict-Transport-Security');
  res.removeHeader('Upgrade-Insecure-Requests');
  res.removeHeader('Content-Security-Policy');
  
  // 设置防止缓存的头
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
});

// Rate limiting - 放宽限制以适应年会场景
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
  message: {
    success: false,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for static files
    return req.path.startsWith('/static/') || req.path.startsWith('/uploads/');
  }
});
app.use(limiter);

// 为投票相关API设置更宽松的速率限制
const votingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  message: {
    success: false,
    errorCode: 'VOTING_RATE_LIMIT_EXCEEDED',
    message: '投票请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    const readOnlyPaths = ['/statistics', '/ranking', '/progress', '/top-performers', '/recent-activity'];
    return readOnlyPaths.some(path => req.path.includes(path));
  }
});

// 为大屏展示创建专门的速率限制器
const displayLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    errorCode: 'DISPLAY_RATE_LIMIT_EXCEEDED',
    message: '大屏刷新过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 应用不同的速率限制到不同的路由
app.use('/api/votes/statistics', displayLimiter);
app.use('/api/votes/ranking', displayLimiter);
app.use('/api/votes/progress', displayLimiter);
app.use('/api/votes/top-performers', displayLimiter);
app.use('/api/votes/recent-activity', displayLimiter);
app.use('/api/votes', votingLimiter);

// CORS configuration - 允许局域网访问
app.use(cors({
  origin: true, // 允许所有来源（局域网使用）
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// Ensure uploads directory exists in data folder
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (memory storage for compression)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'), false);
    }
  }
});

app.locals.upload = upload;

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);

// Page Routes
app.use('/', pageRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        errorCode: 'FILE_TOO_LARGE',
        message: '文件大小超过限制（最大10MB）'
      });
    }
  }
  
  if (error.message === 'Only JPG and PNG files are allowed') {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_FILE_TYPE',
      message: '只支持JPG和PNG格式的图片文件'
    });
  }
  
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    message: '服务器内部错误，请稍后重试'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: '请求的资源不存在'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 年会投票系统已启动`);
      console.log(`📱 本地访问: http://localhost:${PORT}`);
      console.log(`🌐 局域网访问: http://192.168.0.97:${PORT}`);
      console.log(`👑 管理后台: http://192.168.0.97:${PORT}/admin`);
      console.log(`📺 大屏展示: http://192.168.0.97:${PORT}/ranking-display`);
      console.log(`💡 提示: 其他设备请使用局域网地址访问`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;