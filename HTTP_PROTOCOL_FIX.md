# HTTP协议修复说明

## 问题描述
系统部署后，CSS文件和JS文件引用地址都使用了HTTPS协议，导致在HTTP环境下无法正常加载资源。

## 修复内容

### 1. 服务器配置修复 (server.js)
**问题**: 内容安全策略(CSP)中包含了 `upgrade-insecure-requests` 和 `block-all-mixed-content` 指令，强制浏览器将HTTP请求升级为HTTPS。

**修复**: 移除了强制HTTPS升级的CSP指令
```javascript
// 修复前
res.setHeader('Content-Security-Policy', 
  "default-src 'self' http:; " +
  "script-src 'self' 'unsafe-inline' http:; " +
  "style-src 'self' 'unsafe-inline' http:; " +
  "img-src 'self' data: blob: http:; " +
  "connect-src 'self' http:; " +
  "font-src 'self' http:; " +
  "upgrade-insecure-requests; " +        // ❌ 强制HTTPS升级
  "block-all-mixed-content"              // ❌ 阻止混合内容
);

// 修复后
res.setHeader('Content-Security-Policy', 
  "default-src 'self' http:; " +
  "script-src 'self' 'unsafe-inline' http:; " +
  "style-src 'self' 'unsafe-inline' http:; " +
  "img-src 'self' data: blob: http:; " +
  "connect-src 'self' http:; " +
  "font-src 'self' http:"               // ✅ 允许HTTP协议
);
```

### 2. HTML文件修复 (public/protocol-fix.html)
**问题**: 页面中包含强制HTTPS升级的meta标签。

**修复**: 移除了CSP meta标签
```html
<!-- 修复前 -->
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">

<!-- 修复后 -->
<!-- 已移除该标签 -->
```

### 3. JavaScript文件修复 (public/static/js/scan.js)
**问题**: 摄像头功能检查中强制要求HTTPS协议。

**修复**: 修改协议检查逻辑，支持局域网HTTP环境
```javascript
// 修复前
} else if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    errorMessage = '摄像头功能需要HTTPS安全连接，请使用HTTPS访问或使用手动输入功能';
}

// 修复后
} else if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && 
           !location.hostname.startsWith('192.168.') && 
           !location.hostname.startsWith('10.') && 
           !location.hostname.startsWith('172.')) {
    errorMessage = '摄像头功能需要安全连接或局域网环境，请使用手动输入功能';
}
```

## 验证方法

### 1. 使用测试页面
访问 `http://your-server:3000/test-http-protocol.html` 进行协议测试：
- 检查当前协议是否为HTTP
- 测试CSS/JS资源加载
- 验证API调用协议
- 确认无强制HTTPS升级

### 2. 浏览器开发者工具检查
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 刷新页面
4. 检查所有资源请求是否使用HTTP协议

### 3. 功能测试
- 访问主页: `http://your-server:3000/`
- 检查CSS样式是否正常加载
- 检查JavaScript功能是否正常工作
- 测试API调用是否成功

## 部署建议

### HTTP部署 (推荐用于内网环境)
```bash
npm start
# 或
node server.js
```

### HTTPS部署 (如需要)
```bash
npm run start:https
```

## 注意事项

1. **摄像头功能**: 在HTTP环境下，摄像头功能可能受限，建议：
   - 使用localhost或127.0.0.1进行本地测试
   - 在局域网环境(192.168.x.x, 10.x.x.x, 172.x.x.x)中部署
   - 或提供手动输入二维码内容的备选方案

2. **浏览器缓存**: 修复后如果仍有问题，请：
   - 清除浏览器缓存
   - 使用无痕/隐私模式访问
   - 强制刷新页面 (Ctrl+F5)

3. **安全考虑**: HTTP部署适用于：
   - 内网/局域网环境
   - 开发和测试环境
   - 对安全要求不高的场景

## 文件清单

修改的文件：
- ✅ `server.js` - 移除CSP中的HTTPS强制升级
- ✅ `public/protocol-fix.html` - 移除HTTPS升级meta标签
- ✅ `public/static/js/scan.js` - 修改协议检查逻辑

新增的文件：
- 📄 `test-http-protocol.html` - HTTP协议测试页面
- 📄 `HTTP_PROTOCOL_FIX.md` - 本修复说明文档

## 测试结果

经过修复后，系统应该能够：
- ✅ 在HTTP环境下正常加载CSS和JS文件
- ✅ API调用使用HTTP协议
- ✅ 不会自动重定向到HTTPS
- ✅ 所有功能在HTTP环境下正常工作

如果仍有问题，请检查：
1. 浏览器是否缓存了旧的HTTPS设置
2. 代理服务器是否强制HTTPS重定向
3. 网络环境是否有HTTPS强制策略