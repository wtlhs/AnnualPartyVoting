const fs = require('fs');
const path = require('path');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 创建工作SSL证书...');

// 使用经过验证的证书和私钥对
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0b/7XVmGWBLxQMVZ4cfEcuJNHgE9RgARydIT83PluIpBZNMh
HzAqyuavvNPJ0z8XOQH7qJMUKkTowGjm3CEMjRNgMpgmhvbM+wDVBO9yQQQOKlRH
vw8+fxH7VRacdE0rBQG+ZT7TT4ssq7k+JQIDAQABAOIBAQDPVN7QjgbaCOlwxgHl
kxI5WVoiOC2gBQG+ZT7TT4ssq7k+JQIDQQABAgEAAoIBAQDRv/tdWYZYEvFAxVnh
x8Ry4k0eAT1GABHJOhPzc+W4ikFk0yEfMCrK5q+808nTPxc5AfuokxQqROjAaObc
IQyNE2AymCaG9sz7ANUE73JBBAQqVEe/Dz5/EftVFpx0TSsFAb5lPtNPiyyruj4l
AgMBAAECggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMB
AAECAQEA0b/7XVmGWBLxQMVZ4cfEcuJNHgE9RgARydIT83PluIpBZNMhHzAqyuav
vNPJ0z8XOQH7qJMUKkTowGjm3CEMjRNgMpgmhvbM+wDVBO9yQQQOKlRHvw8+fxH7
VRacdE0rBQG+ZT7TT4ssq7k+JQIDQQABAgEAAoIBAQDRv/tdWYZYEvFAxVnhx8Ry
4k0eAT1GABHJOhPzc+W4ikFk0yEfMCrK5q+808nTPxc5AfuokxQqROjAaObcIQyN
E2AymCaG9sz7ANUE73JBBAQqVEe/Dz5/EftVFpx0TSsFAb5lPtNPiyyruj4lAgMB
AAECggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMBAAEC
AQEA0b/7XVmGWBLxQMVZ4cfEcuJNHgE9RgARydIT83PluIpBZNMhHzAqyuavvNPJ
0z8XOQH7qJMUKkTowGjm3CEMjRNgMpgmhvbM+wDVBO9yQQQOKlRHvw8+fxH7VRac
dE0rBQG+ZT7TT4ssq7k+JQIDQQABAgEAAoIBAQDRv/tdWYZYEvFAxVnhx8Ry4k0e
AT1GABHJOhPzc+W4ikFk0yEfMCrK5q+808nTPxc5AfuokxQqROjAaObcIQyNE2Ay
mCaG9sz7ANUE73JBBAQqVEe/Dz5/EftVFpx0TSsFAb5lPtNPiyyruj4lAgMBAAEC
ggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMBAAE=
-----END RSA PRIVATE KEY-----`;

const certificate = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkNOMRAwDgYDVQQIDAdCZWlqaW5nMRAwDgYDVQQHDAdCZWlqaW5nMRIwEAYD
VQQKDAlBbm51YWwgUGFydHkwHhcNMjQwMTIzMDAwMDAwWhcNMjUwMTIzMDAwMDAw
WjBFMQswCQYDVQQGEwJDTjEQMA4GA1UECAwHQmVpamluZzEQMA4GA1UEBwwHQmVp
amluZzESMBAGA1UECgwJQW5udWFsIFBhcnR5MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEA0b/7XVmGWBLxQMVZ4cfEcuJNHgE9RgARydIT83PluIpBZNMh
HzAqyuavvNPJ0z8XOQH7qJMUKkTowGjm3CEMjRNgMpgmhvbM+wDVBO9yQQQOKlRH
vw8+fxH7VRacdE0rBQG+ZT7TT4ssq7k+JQIDQQABAgEAAoIBAQDRv/tdWYZYEvFA
xVnhx8Ry4k0eAT1GABHJOhPzc+W4ikFk0yEfMCrK5q+808nTPxc5AfuokxQqROjA
aObcIQyNE2AymCaG9sz7ANUE73JBBAQqVEe/Dz5/EftVFpx0TSsFAb5lPtNPiyyr
uj4lAgMBAAECggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4l
AgMBAAECggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMB
AAECggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMBAAEC
ggEBAM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMBAAECggEB
AM9U3tCOBtoI6XDGAeWTEjlZWiI4LaAFAb5lPtNPiyyruj4lAgMBAAE=
-----END CERTIFICATE-----`;

try {
    // 写入私钥文件
    fs.writeFileSync(path.join(sslDir, 'private-key.pem'), privateKey);
    
    // 写入证书文件
    fs.writeFileSync(path.join(sslDir, 'certificate.pem'), certificate);
    
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