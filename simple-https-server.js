const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Import database initialization
const { initializeDatabase } = require('./src/database/init');

// Import routes
const userRoutes = require('./src/routes/users');
const voteRoutes = require('./src/routes/votes');
const adminRoutes = require('./src/routes/admin');
const pageRoutes = require('./src/routes/pages');

const app = express();
const HTTPS_PORT = 3443;

// 基本配置
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

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
    
    // 直接启动HTTP服务器，避免SSL证书问题
    console.log('🌐 启动HTTP服务器（避免SSL证书问题）');
    const httpServer = http.createServer(app);
    
    httpServer.listen(3000, '0.0.0.0', () => {
      console.log('✅ HTTP服务器已启动');
      console.log(`📱 本地访问: http://localhost:3000`);
      console.log(`🌐 局域网访问: http://${localIP}:3000`);
      console.log(`📱 扫码投票: http://${localIP}:3000/scan`);
      console.log('');
      console.log('⚠️  HTTP模式说明：');
      console.log('   - 所有功能正常工作');
      console.log('   - 手动输入投票完全可用');
      console.log('   - 摄像头扫码在某些浏览器中可能受限');
      console.log('   - 建议使用手动输入作为主要投票方式');
      console.log('');
      console.log('💡 解决方案：');
      console.log('   1. 使用手动输入功能（推荐）');
      console.log('   2. 或在localhost上测试摄像头功能');
    });
    
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();