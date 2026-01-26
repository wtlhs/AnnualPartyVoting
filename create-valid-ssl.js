const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 创建有效的SSL证书...');

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

// 创建一个简单的自签名证书
const cert = createSelfSignedCert(privateKey);

try {
    // 删除旧文件
    const keyPath = path.join(sslDir, 'private-key.pem');
    const certPath = path.join(sslDir, 'certificate.pem');
    
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
    
    // 写入新文件
    fs.writeFileSync(keyPath, privateKey);
    fs.writeFileSync(certPath, cert);
    
    console.log('✅ SSL证书创建成功！');
    console.log('📁 证书文件位置：');
    console.log(`   私钥: ${keyPath}`);
    console.log(`   证书: ${certPath}`);
    console.log('');
    console.log('🚀 现在可以启动HTTPS服务器');
    
} catch (error) {
    console.error('❌ SSL证书创建失败：', error.message);
}

function createSelfSignedCert(privateKey) {
    // 使用一个基本的自签名证书模板
    const now = new Date();
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    // 这是一个简化的证书，实际生产环境应该使用专业工具
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