# 🚀 Docker快速部署指南

## ⚡ 一分钟本地部署（Windows）

### 前置条件
- 安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- 克隆或下载本项目到本地

### 快速部署
```bash
# 1. 进入项目目录
cd d:/GitHubProjects/AnnualPartyVoting

# 2. 运行一键构建脚本
build-docker.bat

# 3. 访问应用
# 浏览器打开: http://localhost:3000
```

## 🏗️ 本地Docker命令

### 构建镜像
```bash
docker build -t annual-party-voting:latest .
```

### 运行容器
```bash
# 基础运行（无数据持久化）
docker run -d -p 3000:3000 --name annual-party-voting annual-party-voting:latest

# 持久化运行（推荐）
docker run -d -p 3000:3000 -v %cd%/data:/app/data --name annual-party-voting annual-party-voting:latest

# 使用Docker Volume
docker volume create annual-party-data
docker run -d -p 3000:3000 -v annual-party-data:/app/data --name annual-party-voting annual-party-voting:latest
```

### 管理容器
```bash
# 查看状态
docker ps | grep annual-party

# 查看日志
docker logs annual-party-voting

# 进入容器
docker exec -it annual-party-voting /bin/sh

# 停止容器
docker stop annual-party-voting

# 删除容器
docker rm annual-party-voting
```

## 🌐 服务器部署

### 方式一：直接在服务器构建
```bash
# 1. 上传项目文件
scp -r AnnualPartyVoting user@server:/opt/

# 2. 登录服务器
ssh user@server

# 3. 运行部署脚本
cd /opt/AnnualPartyVoting
chmod +x deploy-server.sh
./deploy-server.sh
```

### 方式二：从本地导出镜像
```bash
# 本地导出镜像
docker save -o annual-party-voting.tar annual-party-voting:latest

# 上传到服务器
scp annual-party-voting.tar user@server:/tmp/

# 服务器导入并运行
ssh user@server
docker load -i /tmp/annual-party-voting.tar
docker volume create annual-party-data
docker run -d -p 3000:3000 -v annual-party-data:/app/data --name annual-party-voting --restart unless-stopped annual-party-voting:latest
```

## 🔧 Nginx配置（80端口）

### 安装Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 配置反向代理
```bash
# 创建配置文件
sudo cat > /etc/nginx/sites-available/annual-party-voting << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/annual-party-voting /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并启动
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 数据管理

### 查看数据库
```bash
# 进入容器查看数据库
docker exec -it annual-party-voting sqlite3 /app/data/voting.db ".tables"
docker exec -it annual-party-voting sqlite3 /app/data/voting.db "SELECT COUNT(*) FROM users;"
```

### 备份数据
```bash
# 运行备份脚本
./backup-data.sh

# 或手动备份
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```

### 恢复数据
```bash
# 从备份恢复
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar xzf /backup/backup-20260202.tar.gz -C /data
```

## 🛠️ 故障排除

### 容器无法启动
```bash
# 查看详细错误
docker logs annual-party-voting

# 检查端口占用
netstat -tlnp | grep :3000

# 重新创建容器
docker rm annual-party-voting
docker run -d -p 3000:3000 -v annual-party-data:/app/data --name annual-party-voting annual-party-voting:latest
```

### 数据库问题
```bash
# 检查数据卷
docker volume inspect annual-party-data

# 检查数据库文件
docker exec -it annual-party-voting ls -la /app/data/

# 修复数据库权限
docker exec -it annual-party-voting chown -R node:node /app/data
```

### 端口冲突
```bash
# 修改端口映射
docker stop annual-party-voting
docker run -d -p 8080:3000 -v annual-party-data:/app/data --name annual-party-voting annual-party-voting:latest
```

## 🌐 访问地址

部署成功后，您可以通过以下地址访问应用：

- **直接访问**: http://your-server-ip:3000
- **Nginx代理**: http://your-server-ip
- **本地测试**: http://localhost:3000

## 📞 更多信息

- 📖 完整指南: [DATABASE_PERSISTENCE_GUIDE.md](DATABASE_PERSISTENCE_GUIDE.md)
- 🔧 部署脚本: [deploy-server.sh](deploy-server.sh)
- 💾 备份脚本: [backup-data.sh](backup-data.sh)
- 🐳 构建脚本: [build-docker.bat](build-docker.bat)