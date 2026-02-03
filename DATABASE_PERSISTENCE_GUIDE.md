# 数据库持久化服务器操作指南

## 🐳 本地Docker镜像制作指南

### 1. 安装Docker Desktop
- 下载并安装 Docker Desktop for Windows
- 启动Docker服务
- 确保Docker正在运行

### 2. 构建本地Docker镜像
```bash
# 进入项目目录
cd d:/GitHubProjects/AnnualPartyVoting

# 构建Docker镜像
docker build -t annual-party-voting:latest .

# 查看镜像
docker images | grep annual-party-voting
```

### 3. 本地测试运行
```bash
# 创建数据目录
mkdir -p ./data

# 运行容器（带数据持久化）
docker run -d -p 3000:3000 -v %cd%/data:/app/data --name annual-party-voting-test annual-party-voting:latest

# 查看容器状态
docker ps | grep annual-party-voting

# 停止测试容器
docker stop annual-party-voting-test
docker rm annual-party-voting-test
```

## 🚀 服务器数据库持久化操作指南

### 方案一：Docker Volume 持久化（推荐）

#### 1. 创建Docker Volume
```bash
# 创建持久化数据卷
docker volume create annual-party-data

# 查看数据卷
docker volume ls | grep annual-party-data
```

#### 2. 运行容器（使用Volume）
```bash
# 运行容器并挂载数据卷
docker run -d \
  -p 3000:3000 \
  -v annual-party-data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

#### 3. 数据备份和恢复
```bash
# 备份数据卷
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar czf /backup/annual-party-backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar xzf /backup/annual-party-backup.tar.gz -C /data

# 查看数据卷内容
docker run --rm -v annual-party-data:/data alpine ls -la /data
```

### 方案二：主机目录挂载（适合直接文件访问）

#### 1. 创建主机数据目录
```bash
# 创建数据目录
sudo mkdir -p /opt/annual-party/data
sudo mkdir -p /opt/annual-party/uploads

# 设置权限
sudo chmod 755 /opt/annual-party/data
sudo chmod 755 /opt/annual-party/uploads
```

#### 2. 运行容器（挂载主机目录）
```bash
# 运行容器并挂载主机目录
docker run -d \
  -p 3000:3000 \
  -v /opt/annual-party/data:/app/data \
  -v /opt/annual-party/uploads:/app/uploads \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

#### 3. 数据备份（主机目录方式）
```bash
# 创建备份目录
sudo mkdir -p /opt/backups

# 备份数据
sudo tar czf /opt/backups/annual-party-data-$(date +%Y%m%d_%H%M%S).tar.gz -C /opt/annual-party data uploads

# 恢复数据
sudo tar xzf /opt/backups/annual-party-data-20260202_103000.tar.gz -C /opt/annual-party
```

## 🔄 服务器部署完整流程

### 1. 准备服务器环境
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 添加用户到docker组
sudo usermod -aG docker $USER
```

### 2. 上传镜像到服务器
```bash
# 方法一：在服务器直接构建（推荐）
# 将项目文件上传到服务器后直接构建

# 方法二：导出/导入镜像
# 本地导出
docker save -o annual-party-voting.tar annual-party-voting:latest

# 上传到服务器
scp annual-party-voting.tar user@server:/tmp/

# 服务器导入
docker load -i /tmp/annual-party-voting.tar
```

### 3. 运行生产容器
```bash
# 使用数据卷方式（推荐）
docker volume create annual-party-data

docker run -d \
  -p 3000:3000 \
  -v annual-party-data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest

# 使用主机目录方式
sudo mkdir -p /opt/annual-party/data
sudo chmod 755 /opt/annual-party/data

docker run -d \
  -p 3000:3000 \
  -v /opt/annual-party/data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

## 📊 数据库文件位置说明

### SQLite数据库文件位置
- **容器内路径**: `/app/data/voting.db`
- **持久化映射**: 根据选择的方案映射到主机或数据卷

### 数据目录结构
```
data/
├── voting.db              # SQLite数据库文件
├── voting.db-journal      # SQLite日志文件
└── backups/              # 应用自动备份目录

uploads/                  # 用户上传文件目录
├── photos/              # 用户照片
└── avatars/             # 头像文件
```

## 🔧 容器管理命令

### 查看容器状态
```bash
# 查看运行中的容器
docker ps | grep annual-party

# 查看容器日志
docker logs annual-party-voting

# 实时查看日志
docker logs -f annual-party-voting
```

### 更新应用
```bash
# 停止旧容器
docker stop annual-party-voting
docker rm annual-party-voting

# 构建新镜像
docker build -t annual-party-voting:v2.0 .

# 运行新容器（数据会自动保留）
docker run -d \
  -p 3000:3000 \
  -v annual-party-data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:v2.0
```

### 故障排除
```bash
# 进入容器调试
docker exec -it annual-party-voting /bin/sh

# 检查数据文件
docker exec -it annual-party-voting ls -la /app/data

# 查看数据库
docker exec -it annual-party-voting sqlite3 /app/data/voting.db ".tables"
```

## 🛡️ 安全建议

1. **定期备份数据**
2. **设置适当的文件权限**
3. **使用HTTPS（考虑配置SSL证书）**
4. **定期更新Docker镜像**
5. **监控容器运行状态**

## 📞 故障恢复

### 如果容器无法启动
```bash
# 查看详细错误
docker logs annual-party-voting

# 检查数据卷
docker volume inspect annual-party-data

# 重新创建容器
docker rm annual-party-voting
docker run -d \
  -p 3000:3000 \
  -v annual-party-data:/app/data \
  --name annual-party-voting \
  --restart unless-stopped \
  annual-party-voting:latest
```

### 如果数据损坏
```bash
# 从备份恢复
docker stop annual-party-voting

# 恢复数据
docker run --rm -v annual-party-data:/data -v $(pwd):/backup alpine tar xzf /backup/annual-party-backup.tar.gz -C /data

# 重启容器
docker start annual-party-voting
```