#!/bin/bash

echo "💾 年会投票系统 - 数据备份脚本"
echo "==============================="

# 配置变量
CONTAINER_NAME="annual-party-voting"
VOLUME_NAME="annual-party-data"
BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/annual-party-backup-$TIMESTAMP.tar.gz"

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ 容器 $CONTAINER_NAME 未运行"
    echo "尝试启动容器..."
    docker start $CONTAINER_NAME
    sleep 5
fi

# 创建备份目录
echo "📁 创建备份目录..."
sudo mkdir -p $BACKUP_DIR
sudo chmod 755 $BACKUP_DIR

# 备份数据卷数据
echo "📦 备份SQLite数据库..."
docker run --rm \
    -v $VOLUME_NAME:/data \
    -v $BACKUP_DIR:/backup \
    alpine tar czf /backup/annual-party-data-$TIMESTAMP.tar.gz -C /data .

if [ $? -eq 0 ]; then
    echo "✅ 数据库备份成功: annual-party-data-$TIMESTAMP.tar.gz"
else
    echo "❌ 数据库备份失败"
    exit 1
fi

# 备份上传文件
echo "📁 备份上传文件..."
if [ -d "/opt/annual-party/uploads" ]; then
    sudo tar czf $BACKUP_DIR/annual-party-uploads-$TIMESTAMP.tar.gz -C /opt/annual-party uploads
    echo "✅ 上传文件备份成功: annual-party-uploads-$TIMESTAMP.tar.gz"
else
    echo "⚠️  上传目录不存在，跳过上传文件备份"
fi

# 创建完整备份
echo "📦 创建完整备份..."
docker run --rm \
    -v $VOLUME_NAME:/data \
    -v /opt/annual-party:/host-data \
    -v $BACKUP_DIR:/backup \
    alpine tar czf /backup/annual-party-full-$TIMESTAMP.tar.gz \
    -C /data . \
    -C /host-data uploads

if [ $? -eq 0 ]; then
    echo "✅ 完整备份成功: annual-party-full-$TIMESTAMP.tar.gz"
else
    echo "❌ 完整备份失败"
fi

# 清理旧备份（保留最近7个）
echo "🧹 清理旧备份..."
cd $BACKUP_DIR
ls -t annual-party-*.tar.gz | tail -n +8 | xargs -r rm
echo "✅ 旧备份清理完成"

# 显示备份信息
echo ""
echo "📊 备份信息:"
echo "  备份目录: $BACKUP_DIR"
echo "  当前备份文件:"
ls -lh $BACKUP_DIR/annual-party-*-$TIMESTAMP.tar.gz

echo ""
echo "🔄 恢复命令:"
echo "  恢复数据库: docker run --rm -v $VOLUME_NAME:/data -v $BACKUP_DIR:/backup alpine tar xzf /backup/annual-party-data-$TIMESTAMP.tar.gz -C /data"
echo "  恢复上传文件: sudo tar xzf $BACKUP_DIR/annual-party-uploads-$TIMESTAMP.tar.gz -C /opt/annual-party"
echo "  恢复完整备份: docker run --rm -v $VOLUME_NAME:/data -v /opt/annual-party:/host-data -v $BACKUP_DIR:/backup alpine tar xzf /backup/annual-party-full-$TIMESTAMP.tar.gz -C /"

echo ""
echo "✅ 备份完成！"