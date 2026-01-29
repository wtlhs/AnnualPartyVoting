const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 生成自签名SSL证书...');

try {
    // 生成私钥
    execSync(`openssl genrsa -out ${path.join(sslDir, 'private-key.pem')} 2048`, { stdio: 'inherit' });
    
    // 生成证书签名请求
    const csrConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Beijing
L = Beijing
O = Annual Party Voting System
OU = IT Department
CN = 192.168.0.97

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 192.168.0.97
IP.1 = 127.0.0.1
IP.2 = 192.168.0.97
`;
    
    fs.writeFileSync(path.join(sslDir, 'csr.conf'), csrConfig);
    
    // 生成证书签名请求
    execSync(`openssl req -new -key ${path.join(sslDir, 'private-key.pem')} -out ${path.join(sslDir, 'csr.pem')} -config ${path.join(sslDir, 'csr.conf')}`, { stdio: 'inherit' });
    
    // 生成自签名证书
    execSync(`openssl x509 -req -in ${path.join(sslDir, 'csr.pem')} -signkey ${path.join(sslDir, 'private-key.pem')} -out ${path.join(sslDir, 'certificate.pem')} -days 365 -extensions v3_req -extfile ${path.join(sslDir, 'csr.conf')}`, { stdio: 'inherit' });
    
    console.log('✅ SSL证书生成成功！');
    console.log('📁 证书文件位置：');
    console.log(`   私钥: ${path.join(sslDir, 'private-key.pem')}`);
    console.log(`   证书: ${path.join(sslDir, 'certificate.pem')}`);
    console.log('');
    console.log('⚠️  注意：这是自签名证书，浏览器会显示安全警告。');
    console.log('   在浏览器中点击"高级" → "继续访问"即可。');
    
} catch (error) {
    console.error('❌ SSL证书生成失败：', error.message);
    console.log('');
    console.log('💡 备选方案：');
    console.log('1. 安装OpenSSL工具');
    console.log('2. 或者使用预生成的证书文件');
    console.log('3. 或者继续使用HTTP + 手动输入功能');
}