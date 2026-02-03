# 年会最佳服装评选H5应用

一个基于Node.js + Express的移动端投票系统，用于公司年会活动中评选最佳服装打扮。

## 功能特性

- 📱 移动端H5应用，支持响应式设计
- 👤 用户注册和身份管理
- 📷 头像上传和管理
- 🔍 二维码生成和扫描投票
- 🗳️ 投票限制机制（每人只能为一名男士和一名女士投票）
- 📊 实时投票统计和排名展示
- 💻 电脑端大屏排名展示
- 🛡️ 管理后台和数据导出
- 🐳 Docker容器化部署
- 💾 数据库持久化支持

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite
- **前端**: HTML5 + CSS3 + JavaScript
- **容器化**: Docker + Docker Volume
- **反向代理**: Nginx（可选）

## 🚀 快速部署

### 方式一：Docker本地构建（Windows）

1. **安装Docker Desktop**
   - 下载并安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)

2. **构建Docker镜像**
   ```bash
   # 运行构建脚本
   build-docker.bat
   ```

3. **本地测试运行**
   ```bash
   # 脚本会自动测试运行，访问 http://localhost:3000
   ```

### 方式二：服务器部署

1. **上传项目到服务器**
   ```bash
   scp -r AnnualPartyVoting user@server:/opt/
   ```

2. **运行部署脚本**
   ```bash
   cd /opt/AnnualPartyVoting
   chmod +x deploy-server.sh
   ./deploy-server.sh
   ```

3. **配置Nginx反向代理（可选）**
   ```bash
   # 将80端口指向3000端口
   sudo apt install nginx
   # 配置文件见 DATABASE_PERSISTENCE_GUIDE.md
   ```

## 📦 数据持久化

### Docker Volume方式（推荐）
```bash
# 创建数据卷
docker volume create annual-party-data

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v annual-party-data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

### 主机目录方式
```bash
# 创建数据目录
sudo mkdir -p /opt/annual-party/data
sudo chmod 755 /opt/annual-party/data

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v /opt/annual-party/data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

## 💾 数据备份

### 自动备份脚本
```bash
# 运行备份脚本
./backup-data.sh

# 手动备份
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /data .
```

### 恢复数据
```bash
# 从备份恢复
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /data
```
- **二维码**: qrcode.js + html5-qrcode
- **文件上传**: Multer
- **安全**: Helmet + CORS + Rate Limiting

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动应用

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 3. 访问应用

- 主页: http://localhost:3000
- 扫码投票: http://localhost:3000/scan
- 管理后台: http://localhost:3000/admin
- 电脑端排名展示: http://localhost:3000/ranking-display

## 项目结构

```
annual-party-voting/
├── src/
│   ├── database/           # 数据库配置和初始化
│   └── routes/            # API路由
├── public/                # 静态文件
│   ├── static/
│   │   ├── css/          # 样式文件
│   │   ├── js/           # JavaScript文件
│   │   └── images/       # 图片资源
│   └── *.html            # HTML页面
├── uploads/              # 用户上传的文件
├── data/                 # SQLite数据库文件
├── server.js             # 主服务器文件
└── package.json          # 项目配置
```

## API接口

### 用户管理
- `POST /api/users/register` - 用户注册
- `GET /api/users/:userId` - 获取用户信息
- `POST /api/users/upload-avatar` - 上传头像

### 投票管理
- `POST /api/votes` - 提交投票
- `GET /api/votes/status/:voterId` - 查询投票状态
- `GET /api/votes/ranking` - 获取排行榜
- `GET /api/votes/statistics` - 获取统计数据

### 管理功能
- `GET /api/admin/dashboard` - 管理面板数据
- `GET /api/admin/export` - 导出结果
- `POST /api/admin/clear-data` - 清空数据

## 🚀 最简化部署方案

### 方案一：本地/内网部署（推荐年会使用）

**适用场景**: 公司年会现场，局域网内使用

```bash
# 1. 下载项目到服务器
git clone <项目地址>
cd annual-party-voting

# 2. 安装依赖
npm install

# 3. 启动服务
npm start
```

**访问地址**: `http://服务器IP:3000`

**优势**: 
- 无需外网，数据安全
- 部署简单，5分钟完成
- 支持局域网内所有设备访问

---

### 方案二：云平台一键部署

#### Railway部署（最简单）
1. 访问 [railway.app](https://railway.app)
2. 连接GitHub仓库
3. 自动部署完成

#### Render部署
1. 访问 [render.com](https://render.com)
2. 选择"Web Service"
3. 连接仓库，自动检测Node.js
4. 点击部署

#### Vercel部署
```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

---

### 方案三：Docker部署

创建 `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

部署命令:
```bash
# 构建镜像
docker build -t annual-party-voting .

# 运行容器
docker run -p 3000:3000 -v $(pwd)/data:/app/data annual-party-voting
```

---

### 环境配置

**必需配置**:
```bash
PORT=3000                    # 服务器端口
```

**可选配置**:
```bash
NODE_ENV=production         # 生产环境
ADMIN_PASSWORD=your_password # 管理员密码（默认：admin123）
```

---

### 部署检查清单

- [ ] Node.js 16+ 已安装
- [ ] 端口3000可访问
- [ ] data目录有写入权限
- [ ] uploads目录有写入权限
- [ ] 防火墙已开放3000端口

---

### 故障排除

**常见问题**:

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -ano | findstr :3000
   # 或使用其他端口
   PORT=8080 npm start
   ```

2. **权限问题**
   ```bash
   # 确保目录权限
   chmod 755 data uploads
   ```

3. **依赖安装失败**
   ```bash
   # 清除缓存重新安装
   npm cache clean --force
   npm install
   ```

**技术支持**: 如遇问题，请检查控制台日志或联系技术人员

## 开发说明

### 添加默认头像

将默认头像文件放置在 `public/static/images/` 目录下：
- `default-male.png` - 男士默认头像
- `default-female.png` - 女士默认头像

### 数据库

应用使用SQLite数据库，数据文件存储在 `data/voting.db`。首次启动时会自动创建数据库表结构。

### 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。