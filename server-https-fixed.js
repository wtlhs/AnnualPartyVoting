const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const tls = require('tls');

// Import database initialization
const { initializeDatabase } = require('./src/database/init');

// Import routes
const userRoutes = require('./src/routes/users');
const voteRoutes = require('./src/routes/votes');
const adminRoutes = require('./src/routes/admin');
const pageRoutes = require('./src/routes/pages');

const app = express();

// Trust proxy
app.set('trust proxy', 1);
const HTTP_PORT = 3001;
const HTTPS_PORT = 3443;

// 最小化的安全配置
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', pageRoutes);

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 创建兼容的自签名证书
function createCompatibleCert() {
  const selfsigned = require('selfsigned');
  
  // 使用更兼容的配置
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'CN' },
    { name: 'stateOrProvinceName', value: 'Beijing' },
    { name: 'localityName', value: 'Beijing' },
    { name: 'organizationName', value: 'Annual Party' }
  ];
  
  const options = {
    days: 365,
    keySize: 2048,
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
        name: 'subjectAltName',
        altNames: [
          {
            type: 2, // DNS
            value: 'localhost'
          },
          {
            type: 7, // IP
            ip: '127.0.0.1'
          },
          {
            type: 7, // IP
            ip: '192.168.0.97'
          }
        ]
      }
    ]
  };
  
  const pems = selfsigned.generate(attrs, options);
  
  return {
    key: pems.private,
    cert: pems.cert
  };
}
// 启动服务器
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // 获取本机IP
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
    
    try {
      // 创建兼容的SSL证书
      console.log('🔐 生成兼容的SSL证书...');
      const sslOptions = createCompatibleCert();
      
      // 配置HTTPS服务器选项
      const httpsOptions = {
        key: sslOptions.key,
        cert: sslOptions.cert,
        // 使用更兼容的SSL/TLS配置
        secureProtocol: 'TLSv1_2_method',
        ciphers: [
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-AES256-SHA384',
          'ECDHE-RSA-AES128-SHA',
          'ECDHE-RSA-AES256-SHA',
          'AES128-GCM-SHA256',
          'AES256-GCM-SHA384',
          'AES128-SHA256',
          'AES256-SHA256',
          'AES128-SHA',
          'AES256-SHA'
        ].join(':'),
        honorCipherOrder: true
      };
      
      const httpsServer = https.createServer(httpsOptions, app);
      
      httpsServer.on('error', (error) => {
        console.error('HTTPS服务器错误:', error.message);
        console.log('🔄 启动HTTP服务器作为备用...');
        startHTTPServer(localIP);
      });
      
      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log('🔐 HTTPS服务器已启动（兼容模式）');
        console.log(`📱 本地HTTPS访问: https://localhost:${HTTPS_PORT}`);
        console.log(`🌐 局域网HTTPS访问: https://${localIP}:${HTTPS_PORT}`);
        console.log(`📱 扫码投票: https://${localIP}:${HTTPS_PORT}/scan`);
        console.log('');
        console.log('✅ 使用兼容的SSL/TLS配置');
        console.log('⚠️  首次访问需要接受自签名证书警告');
        console.log('   点击"高级" → "继续访问"即可使用摄像头功能');
      });
      
      // HTTP重定向服务器
      const httpServer = http.createServer((req, res) => {
        const httpsUrl = `https://${req.headers.host.replace(`:${HTTP_PORT}`, `:${HTTPS_PORT}`)}${req.url}`;
        res.writeHead(301, { 'Location': httpsUrl });
        res.end();
      });
      
      httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`🔄 HTTP重定向服务器已启动 (${HTTP_PORT} → ${HTTPS_PORT})`);
      });
      
    } catch (error) {
      console.error('HTTPS启动失败，使用HTTP:', error.message);
      startHTTPServer(localIP);
    }
    
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// HTTP备用服务器
function startHTTPServer(localIP) {
  const httpServer = http.createServer(app);
  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('🌐 HTTP服务器已启动');
    console.log(`📱 本地访问: http://localhost:3000`);
    console.log(`🌐 局域网访问: http://${localIP}:3000`);
    console.log('⚠️  HTTP模式下摄像头功能受限');
  });
}

startServer();