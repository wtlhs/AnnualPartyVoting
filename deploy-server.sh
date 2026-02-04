#!/bin/bash

echo "🚀 年会投票系统 - 服务器部署脚本"
echo "================================="

# 配置变量
IMAGE_NAME="annual-party-voting"
CONTAINER_NAME="annual-party-voting"
VOLUME_NAME="annual-party-data"
BACKUP_DIR="/opt/backups"
DATA_DIR="/opt/annual-party"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装"
    echo "正在安装Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo "✅ Docker安装完成"
fi

# 检查镜像是否存在
if ! docker images | grep -q $IMAGE_NAME; then
    echo "❌ 未找到Docker镜像: $IMAGE_NAME"
    echo "请先构建镜像或从本地导出/导入镜像"
    exit 1
fi

echo "✅ 找到Docker镜像: $IMAGE_NAME"

# 创建数据目录
echo "📁 创建数据目录..."
sudo mkdir -p $DATA_DIR/data
sudo mkdir -p $DATA_DIR/uploads
sudo mkdir -p $BACKUP_DIR
sudo chmod 755 $DATA_DIR/data
sudo chmod 755 $DATA_DIR/uploads
sudo chmod 755 $BACKUP_DIR

# 创建Docker Volume
echo "📦 创建数据卷..."
docker volume create $VOLUME_NAME 2>/dev/null || echo "数据卷已存在"

# 停止并删除旧容器
echo "🛑 停止旧容器..."
docker stop $CONTAINER_NAME 2>/dev/null || echo "没有运行中的容器"
docker rm $CONTAINER_NAME 2>/dev/null || echo "没有旧容器"

# 运行新容器
echo "🚀 启动新容器..."
docker run -d \
    -p 3000:3000 \
    -v $VOLUME_NAME:/app/data \
    -v $DATA_DIR/uploads:/app/uploads \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo "❌ 容器启动失败"
    exit 1
fi

echo "✅ 容器启动成功"

# 等待容器完全启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查容器状态
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✅ 容器运行正常"
    
    # 显示访问信息
    LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    echo ""
    echo "🌐 访问地址:"
    echo "  本地: http://localhost:3000"
    echo "  网络: http://$LOCAL_IP:3000"
    echo ""
    echo "🔧 管理命令:"
    echo "  查看日志: docker logs $CONTAINER_NAME"
    echo "  进入容器: docker exec -it $CONTAINER_NAME /bin/sh"
    echo "  停止容器: docker stop $CONTAINER_NAME"
    echo "  重启容器: docker restart $CONTAINER_NAME"
    echo ""
    echo "📊 数据管理:"
    echo "  数据卷: $VOLUME_NAME"
    echo "  上传目录: $DATA_DIR/uploads"
    echo "  备份目录: $BACKUP_DIR"
    
    # 创建备份脚本
    cat > $BACKUP_DIR/backup.sh << 'EOF'
#!/bin/bash
BACKUP_FILE="/opt/backups/annual-party-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
docker run --rm -v annual-party-data:/data -v /opt/backups:/backup alpine tar czf $BACKUP_FILE -C /data .
echo "备份已创建: $BACKUP_FILE"
EOF
    chmod +x $BACKUP_DIR/backup.sh
    
    echo "💾 创建备份脚本: $BACKUP_DIR/backup.sh"
    echo ""
    echo "🎉 部署完成！"
    
else
    echo "❌ 容器启动失败"
    echo "查看错误日志:"
    docker logs $CONTAINER_NAME
    exit 1
fi

echo ""
echo "📖 查看完整指南: DATABASE_PERSISTENCE_GUIDE.md"