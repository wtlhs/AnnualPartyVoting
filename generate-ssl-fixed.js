const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取本机局域网IP
function getLocalIP() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIP = getLocalIP();
console.log(`📡 检测到本机IP: ${localIP}`);

const attrs = [
    { name: 'commonName', value: String(localIP) }
];


const options = {
    days: 365,
    extensions: [{
        name: 'basicConstraints',
        cA: true,
    }, {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
    }, {
        name: 'subjectAltName',
        altNames: [
            { type: 2, value: 'localhost' },
            { type: 2, value: localIP },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: localIP }
        ]
    }]
};

console.log('🔐 正在生成自签名SSL证书...');

(async () => {
    try {
        // 在 selfsigned v5 中，generate 是异步的
        const pems = await selfsigned.generate(attrs, options);

        const sslDir = path.join(__dirname, 'ssl');
        if (!fs.existsSync(sslDir)) {
            fs.mkdirSync(sslDir, { recursive: true });
        }

        fs.writeFileSync(path.join(sslDir, 'private-key.pem'), pems.private);
        fs.writeFileSync(path.join(sslDir, 'certificate.pem'), pems.cert);
        
        console.log('✅ SSL证书生成成功！');
        console.log('📁 证书已保存到 ssl/ 目录');
        console.log(`   私钥: ${path.join(sslDir, 'private-key.pem')}`);
        console.log(`   证书: ${path.join(sslDir, 'certificate.pem')}`);
        console.log('');
        console.log('🚀 现在可以运行 npm run start:https 启动服务了');
    } catch (err) {
        console.error('❌ 证书生成失败:', err);
    }
})();

