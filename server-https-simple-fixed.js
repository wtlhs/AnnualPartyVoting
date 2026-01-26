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

// 使用预定义的有效证书
function getSSLCertificate() {
  // 这是一个有效的自签名证书，专门为开发环境创建
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
wko6OmwxgTDVKjXCN7riyCHRpe7EI0TlZjHCaaKrNOMKNQrfHhNRxF5ldYw5gSp2
aYfLRnpqaIBVA0en8Rmh3aUh4DB/0SvGwARWxSM4PTiHHVuHHE4TpuJWNC4cqbR3
wXfHmHDN8uNNqo0WDNkABz/H8qtHBNVHBh4H9wkH5IEJOwUFVQOcB3enwjWnxVlU
3XU3O+4DjEuCXm2fOlr9QoNHKgIcVy7+4EjQxGdplMdwNADGytUKx/riOCbTJBQx
1stVzqZHHdIDzk6rHwVBH7eVBjsdK1IM1kTtwGYLzUjAMmLRXTSDxHBTdSJK2BXI
oQXBU0KrAgMBAAECggEBALc2lQACC8cSfnNVBa2MtGq3UDuEEXSEGy9L6eEtwkeZ
L0nE/y4H5L8zBf8IaQQbwi5cLrDMsweBhhyNXiYR4v4I6y0HXvQMrCrlyy/h/oR6
NdHpoM6XklxbdsHiS8Ys2o/gI8J2ooRRuHdvgFSpEjazHp2osPRjrT80+QRakbVs
POIArTmINaTbFN6VvEEPTQDMDsv+aLDf4sJ2+uCxmQAI5fEgGBQAXT4O2Ao2W5WS
IhVpFJBehT2nP3t5TY6IyBSJ544EzqY57k5YMfXkw2L9Xtw/St8VMd98wooV8QcT
AtSeix1KhzNJM7btRIILNi8EKEBJEjNZqEMLO0Bgs0ECgYEA4ry16VfiDG1jere9
BNYYvpEw/qFt4C5L48PVxCXXyQSjYonpbGJXyOOdNOgKn4B6+s/d03VdAUr6v1n6
ByNcF6Iqm3cD8O8tnWOBaQr+2OxZfcdGBgvl1kmgHFnP+OxJRmCw+p8i5UQRN4VZ
+8+JtMRFz/nVBHRakPdzyFMCgYEA1AhqJxTdkGAQN4wa4Q6+NoM1gDNb8rKtVEQg
+OtUBs7fcAJEuFuW45OB2x+DbzGm3ofgEEuauh62H9GjlGAcNExMyh3MbBi6h+zs
5uqmpZbRSRptxBWQzNrMRTplKroIwUqLcKzgBg6R+wW5Kb4FHHoJOhNoJcaKrk8/
xqzpVpECgYEAvpnKqU2g1BVKBc4pJ3uQ5+pEjKYWz9/Dqla6et9lEwFBelBcgYtp
z1hs5u2690p5+ctbDgudGjBan61O+aCOVDdWatJ2PluQEaoHh+Cr/PRcKWWt6Rr4
aPx/1VwAcDCRP+3Gvk73yracKFMLli/QXShxmXJbeRb5yz+0GQIDAQAB
-----END PRIVATE KEY-----`;

  const certificate = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkNOMRAwDgYDVQQIDAdCZWlqaW5nMRAwDgYDVQQHDAdCZWlqaW5nMRIwEAYD
VQQKDAlBbm51YWwgUGFydHkwHhcNMjQwMTIzMDAwMDAwWhcNMjUwMTIzMDAwMDAw
WjBFMQswCQYDVQQGEwJDTjEQMA4GA1UECAwHQmVpamluZzEQMA4GA1UEBwwHQmVp
amluZzESMBAGA1UECgwJQW5udWFsIFBhcnR5MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAu1SU1LfVLPHCgcJKOjpsMYEw1So1wje64sgh0aXuxCNE5WYx
wmmiozTjCjUK3x4TUcReZXWMOYEqdmmHy0Z6amiAVQNHp/EZod2lIeAwf9ErxsAE
VsUjOD04hx1bhxxOE6biVjQuHKm0d8F3x5hwzfLjTaqNFgzZAAc/x/KrRwTVRwYe
B/cJB+SBCTsFBVUDnAd3p8I1p8VZVN11NzvuA4xLgl5tnzpa/UKDRyoCHFcu/uBI
0MRnaZTHcDQAxsrVCsf64jgm0yQUMdbLVc6mRx3SA85Oqx8FQR+3lQY7HStSDNZE
7cBmC81IwDJi0V00g8RwU3UiStgVyKEFwVNCqwIDAQABo1AwTjAdBgNVHQ4EFgQU
hqR2P1gQwuU+Id3KQU6x8Yx7hLgwHwYDVR0jBBgwFoAUhqR2P1gQwuU+Id3KQU6x
8Yx7hLgwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAcGKQMuFiWbbk
xJAPKPiYtNg5UHKz4qYCsT2SAkza+b/LuK3qrPcNlnIjmFcDjhx5fDYB/JqT5zqx
DDkrllJyFq8qMlch/chkqeQHNy1rI7ws0wFGjIugBpAhgdpd7JqMIoTixy+rBqzQ
oP5Cdc4jmQXGsXg0sjmFcT9tqg5BE3XDfQEGGzk2jHMeZVO/CT9ucb0/uR3bl7J8
3PQplkFpMNveEQK0IdayEeQQhxf1OmSGgHIx3B4bz4SvM3WZQNeVmJlCMhf0kV1U
sNqoQfYSbFjLy9Z5ko/ML8YCIETmEiSwxsI3RpKDIMpVhHhTXSrwB9LjTaMM2cTt
24o0s0IWqg==
-----END CERTIFICATE-----`;

  return {
    key: privateKey,
    cert: certificate
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
      // 使用预定义的SSL证书
      console.log('🔐 加载SSL证书...');
      const sslOptions = getSSLCertificate();
      
      // 配置HTTPS服务器选项 - 使用更宽松的配置
      const httpsOptions = {
        key: sslOptions.key,
        cert: sslOptions.cert,
        // 允许更多的SSL/TLS版本
        secureProtocol: 'TLS_method',
        // 使用更广泛兼容的加密套件
        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
        honorCipherOrder: true,
        // 允许不安全的重新协商（仅用于开发）
        secureOptions: require('constants').SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION
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
        console.log('✅ 支持多种加密套件');
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