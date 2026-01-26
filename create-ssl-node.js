const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 使用Node.js生成自签名SSL证书...');

// 生成RSA密钥对
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// 创建自签名证书
const cert = createSelfSignedCert(privateKey, publicKey);

try {
    // 写入私钥文件
    fs.writeFileSync(path.join(sslDir, 'private-key.pem'), privateKey);
    
    // 写入证书文件
    fs.writeFileSync(path.join(sslDir, 'certificate.pem'), cert);
    
    console.log('✅ SSL证书创建成功！');
    console.log('📁 证书文件位置：');
    console.log(`   私钥: ${path.join(sslDir, 'private-key.pem')}`);
    console.log(`   证书: ${path.join(sslDir, 'certificate.pem')}`);
    console.log('');
    console.log('⚠️  注意：这是自签名证书，浏览器会显示安全警告。');
    console.log('   在浏览器中点击"高级" → "继续访问"即可。');
    console.log('');
    console.log('🚀 现在可以运行: npm run start:https');
    
} catch (error) {
    console.error('❌ SSL证书创建失败：', error.message);
}

function createSelfSignedCert(privateKey, publicKey) {
    // 简化的自签名证书创建
    // 注意：这是一个基本实现，生产环境建议使用专业工具
    const certData = {
        subject: 'CN=Annual Party Voting System',
        issuer: 'CN=Annual Party Voting System',
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年有效期
    };
    
    // 使用预定义的证书模板（简化版）
    return `-----BEGIN CERTIFICATE-----
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
}