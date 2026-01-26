const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Import database initialization
const { initializeDatabase } = require('./src/database/init');

// Import routes
const userRoutes = require('./src/routes/users');
const voteRoutes = require('./src/routes/votes');
const adminRoutes = require('./src/routes/admin');
const pageRoutes = require('./src/routes/pages');

const app = express();

// Trust proxy to get real IP addresses
app.set('trust proxy', 1);
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// HTTPS优化的安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// HTTP到HTTPS重定向中间件
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && req.secure !== true) {
    // 在生产环境中重定向到HTTPS
    if (process.env.NODE_ENV === 'production') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: {
    success: false,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    return req.path.startsWith('/static/') || req.path.startsWith('/uploads/');
  }
});
app.use(limiter);

// 投票相关API的速率限制
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

// 大屏展示的速率限制
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

// 应用速率限制
app.use('/api/votes/statistics', displayLimiter);
app.use('/api/votes/ranking', displayLimiter);
app.use('/api/votes/progress', displayLimiter);
app.use('/api/votes/top-performers', displayLimiter);
app.use('/api/votes/recent-activity', displayLimiter);
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

// 读取SSL证书
function loadSSLCertificates() {
  const sslDir = path.join(__dirname, 'ssl');
  const keyPath = path.join(sslDir, 'private-key.pem');
  const certPath = path.join(sslDir, 'certificate.pem');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const key = fs.readFileSync(keyPath, 'utf8');
      const cert = fs.readFileSync(certPath, 'utf8');
      
      // 验证证书格式
      if (key.includes('-----BEGIN') && cert.includes('-----BEGIN')) {
        console.log('✅ SSL证书文件读取成功');
        return { key, cert };
      } else {
        console.warn('⚠️  SSL证书格式无效');
        return null;
      }
    } catch (error) {
      console.warn('⚠️  SSL证书读取失败:', error.message);
      return null;
    }
  } else {
    console.log('⚠️  SSL证书文件不存在');
    return null;
  }
}

// Initialize database and start servers
async function startServers() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // 获取本机IP地址
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = '127.0.0.1';
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
    }
    
    // 尝试启动HTTPS服务器
    const sslOptions = loadSSLCertificates();
    
    if (sslOptions) {
      try {
        // 启动HTTPS服务器
        const httpsServer = https.createServer(sslOptions, app);
        httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
          console.log('🔐 HTTPS服务器已启动');
          console.log(`📱 本地HTTPS访问: https://localhost:${HTTPS_PORT}`);
          console.log(`🌐 局域网HTTPS访问: https://${localIP}:${HTTPS_PORT}`);
          console.log(`👑 管理后台: https://${localIP}:${HTTPS_PORT}/admin`);
          console.log(`📺 大屏展示: https://${localIP}:${HTTPS_PORT}/ranking-display`);
          console.log(`📱 扫码投票: https://${localIP}:${HTTPS_PORT}/scan`);
          console.log('');
          console.log('⚠️  注意：首次访问时浏览器会显示安全警告');
          console.log('   请点击"高级" → "继续访问"来接受自签名证书');
        });
        
        // 同时启动HTTP服务器用于重定向
        const httpServer = http.createServer((req, res) => {
          res.writeHead(301, { 
            'Location': `https://${req.headers.host.replace(`:${HTTP_PORT}`, `:${HTTPS_PORT}`)}${req.url}` 
          });
          res.end();
        });
        
        httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
          console.log(`🔄 HTTP重定向服务器已启动 (端口 ${HTTP_PORT} → ${HTTPS_PORT})`);
        });
        
      } catch (httpsError) {
        console.error('⚠️  HTTPS服务器启动失败:', httpsError.message);
        console.log('🔄 回退到HTTP模式...');
        startHTTPServer(localIP);
      }
    } else {
      console.log('⚠️  未找到有效的SSL证书，启动HTTP服务器');
      console.log('💡 要启用HTTPS，请运行: node create-matching-ssl.js');
      startHTTPServer(localIP);
    }
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// HTTP服务器回退函数
function startHTTPServer(localIP) {
  const httpServer = http.createServer(app);
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('🌐 HTTP服务器已启动');
    console.log(`📱 本地访问: http://localhost:${HTTP_PORT}`);
    console.log(`🌐 局域网访问: http://${localIP}:${HTTP_PORT}`);
    console.log(`👑 管理后台: http://${localIP}:${HTTP_PORT}/admin`);
    console.log(`📺 大屏展示: http://${localIP}:${HTTP_PORT}/ranking-display`);
    console.log(`📱 扫码投票: http://${localIP}:${HTTP_PORT}/scan`);
    console.log('');
    console.log('⚠️  注意：HTTP模式下摄像头功能可能受限');
    console.log('   建议使用手动输入功能进行投票');
  });
}

startServers();

module.exports = app;