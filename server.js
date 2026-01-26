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

// Security middleware - 针对局域网访问优化
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // 允许HTML属性中的内联事件处理器
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  // 禁用可能导致局域网访问问题的安全策略
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  originAgentCluster: false,
  // 禁用HSTS以避免强制HTTPS
  hsts: false
}));

// 添加协议检测中间件
app.use((req, res, next) => {
  // 检测是否是通过HTTPS访问的HTTP服务器
  const isHTTPSRequest = req.headers['x-forwarded-proto'] === 'https' || 
                         req.connection.encrypted || 
                         req.secure;
  
  // 如果检测到HTTPS请求但服务器是HTTP，重定向到协议修复页面
  if (isHTTPSRequest && req.path !== '/protocol-fix.html') {
    return res.redirect('http://' + req.get('host') + '/protocol-fix.html');
  }
  
  next();
});
app.use((req, res, next) => {
  // 强制禁用HSTS - 使用最强的设置
  res.removeHeader('Strict-Transport-Security');
  res.setHeader('Strict-Transport-Security', 'max-age=0; includeSubDomains; preload');
  
  // 添加强制缓存控制头
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // 添加明确的协议头
  res.setHeader('X-Forwarded-Proto', 'http');
  res.setHeader('X-Forwarded-SSL', 'off');
  res.setHeader('X-Forwarded-Port', '3000');
  
  // 添加内容安全策略，强制使用HTTP
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' http:; " +
    "script-src 'self' 'unsafe-inline' http:; " +
    "style-src 'self' 'unsafe-inline' http:; " +
    "img-src 'self' data: blob: http:; " +
    "connect-src 'self' http:; " +
    "font-src 'self' http:; " +
    "upgrade-insecure-requests; " +
    "block-all-mixed-content"
  );
  
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
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain paths if needed
  skip: (req, res) => {
    // Skip rate limiting for static files
    return req.path.startsWith('/static/') || req.path.startsWith('/uploads/');
  }
});
app.use(limiter);

// 为投票相关API设置更宽松的速率限制
const votingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 每个IP在5分钟内最多50次投票相关请求
  message: {
    success: false,
    errorCode: 'VOTING_RATE_LIMIT_EXCEEDED',
    message: '投票请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 为大屏展示和统计查询提供更宽松的限制
  skip: (req, res) => {
    // 跳过对统计和排名查询的限制，这些是只读操作
    const readOnlyPaths = ['/statistics', '/ranking', '/progress', '/top-performers', '/recent-activity'];
    return readOnlyPaths.some(path => req.path.includes(path));
  }
});

// 为大屏展示创建专门的速率限制器
const displayLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 每分钟最多100次请求，足够支持多个大屏同时刷新
  message: {
    success: false,
    errorCode: 'DISPLAY_RATE_LIMIT_EXCEEDED',
    message: '大屏刷新过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 应用不同的速率限制到不同的路由
// 为只读的统计和排名API应用宽松限制
app.use('/api/votes/statistics', displayLimiter);
app.use('/api/votes/ranking', displayLimiter);
app.use('/api/votes/progress', displayLimiter);
app.use('/api/votes/top-performers', displayLimiter);
app.use('/api/votes/recent-activity', displayLimiter);

// 为其他投票相关API应用标准限制
app.use('/api/votes', votingLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only JPG and PNG files
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'), false);
    }
  }
});

// Make upload middleware available to routes
app.locals.upload = upload;

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);

// Page Routes (serve HTML pages)
app.use('/', pageRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        errorCode: 'FILE_TOO_LARGE',
        message: '文件大小超过限制（最大2MB）'
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
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Access the application at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;