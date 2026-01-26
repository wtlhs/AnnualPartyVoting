# 🔐 HTTPS部署指南 - 支持摄像头功能

## 🎯 为什么需要HTTPS？

现代浏览器要求摄像头访问必须在HTTPS环境下，为了让手机用户能够正常使用扫码功能，我们需要启用HTTPS支持。

## 🚀 快速部署

### Windows用户
```bash
# 一键HTTPS部署
deploy.bat https
```

### Linux/Mac用户
```bash
# 一键HTTPS部署
chmod +x deploy.sh
./deploy.sh https
```

### 手动部署
```bash
# 1. 生成SSL证书
npm run generate-ssl

# 2. 启动HTTPS服务器
npm run start:https
```

## 📋 部署步骤详解

### 1. 生成SSL证书
系统会自动生成自签名SSL证书：
```bash
node create-ssl-simple.js
```

证书文件将保存在 `ssl/` 目录下：
- `ssl/private-key.pem` - 私钥文件
- `ssl/certificate.pem` - 证书文件

### 2. 启动HTTPS服务器
```bash
npm run start:https
```

服务器将同时启动：
- **HTTPS服务器**：端口3443（主要服务）
- **HTTP重定向服务器**：端口3000（自动重定向到HTTPS）

### 3. 访问地址
- 本地HTTPS：`https://localhost:3443`
- 局域网HTTPS：`https://你的IP:3443`
- 管理后台：`https://你的IP:3443/admin`
- 扫码投票：`https://你的IP:3443/scan`

## ⚠️ 浏览器安全警告处理

由于使用自签名证书，浏览器会显示安全警告：

### Chrome浏览器
1. 看到"您的连接不是私密连接"警告
2. 点击"高级"
3. 点击"继续前往 [IP地址]（不安全）"

### Firefox浏览器
1. 看到"警告：潜在的安全风险"
2. 点击"高级..."
3. 点击"接受风险并继续"

### Safari浏览器
1. 看到"此连接不是私人连接"
2. 点击"显示详细信息"
3. 点击"访问此网站"

### 移动设备
- **Android Chrome**：点击"高级" → "继续访问"
- **iOS Safari**：点击"高级" → "继续访问"

## 🔧 配置选项

### 自定义端口
```bash
# 自定义HTTPS端口
HTTPS_PORT=8443 npm run start:https

# 或在部署脚本中
HTTPS_PORT=8443 ./deploy.sh https
```

### 环境变量
```bash
# HTTPS端口（默认3443）
HTTPS_PORT=3443

# HTTP重定向端口（默认3000）
HTTP_PORT=3000

# 运行环境
NODE_ENV=production
```

## 📱 摄像头功能验证

### 测试步骤
1. 使用HTTPS访问扫码页面
2. 点击"开始扫描"按钮
3. 浏览器会请求摄像头权限
4. 允许权限后即可正常扫码

### 权限设置
- **Chrome**：地址栏左侧锁图标 → 摄像头 → 允许
- **Firefox**：地址栏左侧盾牌图标 → 权限 → 摄像头 → 允许
- **Safari**：Safari菜单 → 偏好设置 → 网站 → 摄像头 → 允许

## 🌐 局域网部署注意事项

### 1. 防火墙设置
确保开放HTTPS端口：
```bash
# Windows防火墙
netsh advfirewall firewall add rule name="Annual Party HTTPS" dir=in action=allow protocol=TCP localport=3443

# Linux防火墙
sudo ufw allow 3443
```

### 2. 网络配置
- 确保所有设备连接到同一WiFi网络
- 服务器IP地址保持稳定
- 路由器不要开启AP隔离

### 3. 证书信任
每台设备首次访问时都需要接受证书警告。

## 🔍 故障排除

### 问题1：证书生成失败
**解决方案**：
```bash
# 手动创建SSL目录
mkdir ssl

# 重新生成证书
node create-ssl-simple.js
```

### 问题2：端口被占用
**解决方案**：
```bash
# 使用其他端口
HTTPS_PORT=8443 npm run start:https
```

### 问题3：摄像头仍无法访问
**解决方案**：
1. 确认使用HTTPS访问
2. 检查浏览器权限设置
3. 尝试刷新页面
4. 使用隐身模式测试

### 问题4：移动设备无法访问
**解决方案**：
1. 确认设备在同一网络
2. 手动输入完整HTTPS地址
3. 接受证书警告
4. 检查移动浏览器设置

## 📊 性能对比

### HTTP vs HTTPS
| 功能 | HTTP | HTTPS |
|------|------|-------|
| 摄像头扫码 | ❌ 不支持 | ✅ 完全支持 |
| 手动输入 | ✅ 支持 | ✅ 支持 |
| 部署复杂度 | 简单 | 中等 |
| 浏览器兼容 | 完美 | 需接受证书 |
| 安全性 | 一般 | 高 |

### 推荐使用场景
- **年会现场**：推荐HTTPS，支持完整扫码功能
- **内部测试**：可使用HTTP，依赖手动输入
- **生产环境**：必须使用HTTPS

## 🎯 年会现场部署建议

### 1. 提前准备
- 在年会前一天完成HTTPS部署
- 测试不同设备的摄像头功能
- 准备证书接受指导

### 2. 现场支持
- 准备技术人员协助证书接受
- 提供HTTPS访问地址二维码
- 准备手动输入备用方案

### 3. 用户指导
创建简单的操作指南：
1. 扫描二维码访问系统
2. 接受浏览器安全警告
3. 允许摄像头权限
4. 开始扫码投票

## ✨ 总结

通过启用HTTPS支持，系统现在可以：
- ✅ 完全支持手机摄像头扫码
- ✅ 提供更好的用户体验
- ✅ 符合现代浏览器安全要求
- ✅ 保持手动输入备用方案

HTTPS部署让年会投票系统功能更加完整，用户体验更加流畅！