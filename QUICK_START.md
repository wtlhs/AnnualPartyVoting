# 🚀 5分钟快速部署指南

## 方案一：Windows局域网部署（推荐年会使用）

1. **下载项目**
   ```bash
   git clone <项目地址>
   cd annual-party-voting
   ```

2. **局域网部署**
   ```
   双击运行: deploy.bat lan
   ```
   或者命令行运行:
   ```bash
   deploy.bat lan
   ```

3. **访问应用**
   - 服务器本地：http://localhost:3000
   - 局域网访问：http://你的IP:3000（脚本会自动显示）
   - 管理后台：http://你的IP:3000/admin（密码：admin123）

---

## 方案二：Linux/Mac局域网部署

1. **下载项目**
   ```bash
   git clone <项目地址>
   cd annual-party-voting
   ```

2. **局域网部署**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh lan
   ```

3. **访问应用**
   - 服务器本地：http://localhost:3000
   - 局域网访问：http://你的IP:3000（脚本会自动显示）
   - 管理后台：http://你的IP:3000/admin（密码：admin123）

---

## 方案三：仅本地部署

### Windows
```
双击运行: deploy.bat
```

### Linux/Mac
```bash
./deploy.sh
```

---

## 方案四：手动部署

```bash
# 1. 安装依赖
npm install

# 2. 启动服务（选择一种）
npm start              # 本地访问
npm run start:lan      # 局域网访问
```

---

## 🌐 局域网访问设置

### 自动获取IP地址
部署脚本会自动显示局域网访问地址，例如：
```
访问地址:
  本地: http://localhost:3000
  局域网: http://172.18.0.250:3000
  管理后台: http://172.18.0.250:3000/admin
  大屏展示: http://172.18.0.250:3000/ranking-display
```

### 手动查看IP地址
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
# 或
ip addr show
```

### 防火墙设置
- **Windows**: 允许Node.js通过Windows防火墙
- **Linux**: `sudo ufw allow 3000`
- **Mac**: 系统偏好设置 → 安全性与隐私 → 防火墙

---

## 🔧 故障排除

### 局域网访问问题

**问题**: 手机无法访问服务器
**解决方案**:
1. 确保手机和服务器在同一WiFi网络
2. 使用 `npm run start:lan` 启动服务
3. 检查防火墙是否开放3000端口
4. 尝试关闭服务器防火墙测试

**问题**: 出现CORS或安全策略错误
**解决方案**:
1. 使用局域网专用启动命令：`npm run start:lan`
2. 这会禁用可能导致局域网访问问题的安全策略

**问题**: 静态资源加载失败
**解决方案**:
1. 确保使用正确的IP地址访问
2. 检查控制台是否有网络错误
3. 重启服务器：`Ctrl+C` 然后重新运行部署脚本

### 常见错误代码

- **ERR_SSL_PROTOCOL_ERROR**: 使用 `npm run start:lan` 启动
- **CORS错误**: 使用局域网部署模式
- **端口占用**: 使用 `PORT=8080 npm run start:lan` 更换端口

---

## 📱 移动设备测试

1. **连接同一WiFi**: 确保手机和服务器在同一网络
2. **访问测试**: 在手机浏览器输入局域网地址
3. **功能测试**: 测试注册、投票、扫码等功能
4. **性能测试**: 多台设备同时访问测试

---

## 🎯 年会现场部署建议

1. **提前测试**: 在年会前一天完成部署和测试
2. **网络准备**: 确保会场WiFi稳定，获取服务器IP地址
3. **设备准备**: 准备大屏设备用于展示排名
4. **备用方案**: 准备移动热点作为备用网络
5. **技术支持**: 安排技术人员现场支持

---

## 技术支持

如遇问题，请检查：
1. Node.js版本是否16+
2. 是否使用了正确的启动命令（`npm run start:lan`）
3. 防火墙是否开放端口
4. 设备是否在同一网络
5. 控制台是否有错误信息