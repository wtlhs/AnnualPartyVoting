const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const os = require('os');

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

// 获取本机IP地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

// HTTPS优化的安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 强制HTTPS中间件
app.use((req, res, next) => {
  // 设置安全头
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 强制HTTPS协议头
  res.setHeader('X-Forwarded-Proto', 'https');
  res.setHeader('X-Forwarded-SSL', 'on');
  res.setHeader('X-Forwarded-Port', HTTPS_PORT.toString());
  
  next();
});

// Rate limiting - 适应年会场景
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

// CORS configuration for HTTPS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with HTTPS headers
app.use('/static', express.static(path.join(__dirname, 'public/static'), {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads'), {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Ensure uploads directory exists in data folder
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join('data', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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

// SSL证书配置
function getSSLOptions() {
  const certPath = path.join(__dirname, 'ssl', 'certificate.pem');
  const keyPath = path.join(__dirname, 'ssl', 'private-key.pem');
  
  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    }
  } catch (error) {
    console.error('SSL证书读取失败:', error.message);
  }
  
  // 如果证书不存在，生成自签名证书
  console.log('🔧 SSL证书不存在，正在生成自签名证书...');
  const selfsigned = require('selfsigned');
  
  const localIP = getLocalIP();
  const attrs = [{ name: 'commonName', value: localIP }];
  const opts = {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        timeStamping: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: localIP },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: localIP }
        ]
      }
    ]
  };
  
  const pems = selfsigned.generate(attrs, opts);
  
  // 保存证书到文件
  const sslDir = path.join(__dirname, 'ssl');
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }
  
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  
  console.log('✅ 自签名证书生成成功');
  
  return {
    key: pems.private,
    cert: pems.cert
  };
}

// 启动服务器
async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ 数据库初始化成功');
    
    const localIP = getLocalIP();
    const sslOptions = getSSLOptions();
    
    if (sslOptions) {
      // 启动HTTPS服务器
      const httpsServer = https.createServer(sslOptions, app);
      
      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log('🔐 HTTPS服务器已启动');
        console.log(`📱 本地HTTPS访问: https://localhost:${HTTPS_PORT}`);
        console.log(`🌐 局域网HTTPS访问: https://${localIP}:${HTTPS_PORT}`);
        console.log(`👑 管理后台: https://${localIP}:${HTTPS_PORT}/admin`);
        console.log(`📺 大屏展示: https://${localIP}:${HTTPS_PORT}/ranking-display`);
        console.log(`📱 扫码投票: https://${localIP}:${HTTPS_PORT}/scan`);
        console.log(`👥 用户列表投票: https://${localIP}:${HTTPS_PORT}/user-list`);
        console.log('');
        console.log('⚠️  注意：首次访问时浏览器会显示安全警告');
        console.log('   请点击"高级"→"继续访问"来接受自签名证书');
        console.log('');
      });
      
      // 启动HTTP重定向服务器
      const httpServer = http.createServer((req, res) => {
        res.writeHead(301, { 
          'Location': `https://${req.headers.host.replace(`:${HTTP_PORT}`, `:${HTTPS_PORT}`)}${req.url}` 
        });
        res.end();
      });
      
      httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`🔄 HTTP重定向服务器已启动 (端口 ${HTTP_PORT} → ${HTTPS_PORT})`);
      });
      
    } else {
      console.error('❌ SSL证书配置失败，无法启动HTTPS服务器');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;