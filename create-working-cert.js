const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 创建工作证书...');

// 使用一个已知工作的证书和密钥对
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAu1SU1LfVLPHCgcJKOjpsMYEw1So1wje64sgh0aXuxCNE5WYx
wmmiozTjCjUK3x4TUcReZXWMOYEqdmmHy0Z6amiAVQNHp/EZod2lIeAwf9ErxsAE
VsUjOD04hx1bhxxOE6biVjQuHKm0d8F3x5hwzfLjTaqNFgzZAAc/x/KrRwTVRwYe
B/cJB+SBCTsFBVUDnAd3p8I1p8VZVN11NzvuA4xLgl5tnzpa/UKDRyoCHFcu/uBI
0MRnaZTHcDQAxsrVCsf64jgm0yQUMdbLVc6mRx3SA85Oqx8FQR+3lQY7HStSDNZE
7cBmC81IwDJi0V00g8RwU3UiStgVyKEFwVNCqwIDAQABAoIBAQC3NpUAAgvHEn5z
VQWtjLRqt1A7hBF0hBsvS+nhLcJHmS9JxP8uB+S/MwX/CGkEG8IuXC6wzLMHgYYc
jV4mEeL+COstB170DKwq5csv4f6EejXR6aDOl5JcW3bB4kvGLNqP4CPCdqKEUbh3
b4BUqRI2sx6dqLD0Y60/NPkEWpG1bDziAK05iDWk2xTelbxBD00AzA7L/miw3+LC
dvrgsZkACOXxIBgUAF0+DtgKNluVkiIVaRSQXoU9pz97eU2OiMgUieeOBM6mOe5O
WDH15MNi/V7cP0rfFTHffMKKFfEHEwLUnoscSoczSTO27USCCzYvBChASRIzWahD
CztAYLNBAoGBAOK8telX4gxtY3q3vQTWGL6RMP6hbeAuS+PD1cQl18kEo2KJ6Wxi
V8jjnTToCp+AevrP3dN1XQFK+r9Z+gcjXBeiKpt3A/DvLZ1jgWkK/tjsWX3HRgYL
5dZJoBxZz/jsSUZgsP6fIuVEETeFWfvPibTERc/51QR0WpD3c8hTAoGBANQIaicU
3ZBgEDeMGuEOvjaDNYAzW/KyrVREIPjrVAbO33ACRLhbluOTgdsfg28xpt6H4BBL
mroeth/Ro5RgHDRMTModzGwYuofs7ObqpqWW0UkabcQVkMzazEU6ZSq6CMFKi3Cs
4AYOkfsFuSm+BRx6CToTaCXGiq5PP8as6VaRAoGBAL6ZyqlNoNQVSgXOKSd7kOfq
RIymFs/fw6pWunrfZRMBQXpQXIGLac9YbObtuvdKefnLWw4LnRowWp+tTvmgjlQ3
VmrSdj5bkBGqB4fgq/z0XCllrekq+Gj8f9VcAHAwkT/txr5O98q2nChTC5Yv0F0o
cZlyW3kW+cs/tBkCAwEAAQKBgQC+mcqpTaDUFUoFziknexDn6kSMphbP38OqVrp6
32UTAUFaUFyBi2nPWGzm7br3Snn5y1sOC50aMFqfrU75oI5UN1Zq0nY+W5ARqgeH
4Kv89FwpZa3pGvho/H/VXABwMJE/7ca+TvfKtpwoUwuWL9BdKHGZclt5FvnLP7QZ
AgMBAAE=
-----END RSA PRIVATE KEY-----`;

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

try {
    // 删除旧文件
    const keyPath = path.join(sslDir, 'private-key.pem');
    const certPath = path.join(sslDir, 'certificate.pem');
    
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
    
    // 写入新文件
    fs.writeFileSync(keyPath, privateKey);
    fs.writeFileSync(certPath, certificate);
    
    console.log('✅ SSL证书创建成功！');
    console.log('📁 证书文件位置：');
    console.log(`   私钥: ${keyPath}`);
    console.log(`   证书: ${certPath}`);
    console.log('');
    console.log('🚀 现在可以启动HTTPS服务器');
    
} catch (error) {
    console.error('❌ SSL证书创建失败：', error.message);
}