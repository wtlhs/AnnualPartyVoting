const fs = require('fs');
const path = require('path');

// 创建SSL证书目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

console.log('🔐 创建简单的自签名SSL证书...');

// 简单的自签名证书（用于开发和测试）
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
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV
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
8Yx7hLgwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOCAQEAcGKQMuFiWbbk
xJAPKPiYtNg5UHKz4qYCsT2SAkza+b/LuK3qrPcNlnIjmFcDjhx5fDYB/JqT5zqx
DDkrllJyFq8qMlch/chkqeQHNy1rI7ws0wFGjIugBpAhgdpd7JqMIoTixy+rBqzQ
oP5Cdc4jmQXGsXg0sjmFcT9tqg5BE3XDfQEGGzk2jHMeZVO/CT9ucb0/uR3bl7J8
3PQplkFpMNveEQK0IdayEeQQhxf1OmSGgHIx3B4bz4SvM3WZQNeVmJlCMhf0kV1U
sNqoQfYSbFjLy9Z5ko/ML8YCIETmEiSwxsI3RpKDIMpVhHhTXSrwB9LjTaMM2cTt
24o0s0IWqg==
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