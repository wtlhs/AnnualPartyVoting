#!/bin/bash

echo "🚀 年会投票系统 - 一键部署脚本"
echo "=================================="

# 检查部署模式
if [ "$1" = "https" ]; then
    echo "🔐 HTTPS部署模式（支持摄像头）"
    START_SCRIPT="npm run start:https"
elif [ "$1" = "lan" ]; then
    echo "🌐 局域网部署模式"
    START_SCRIPT="npm run start:lan"
else
    echo "💻 本地部署模式"
    START_SCRIPT="npm start"
fi

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 16+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ npm 版本: $(npm --version)"

# 安装依赖
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 创建必要目录
mkdir -p data uploads ssl
echo "✅ 创建必要目录"

# 如果是HTTPS模式，生成SSL证书
if [ "$1" = "https" ]; then
    echo "🔐 生成SSL证书..."
    node create-ssl-simple.js
    if [ $? -ne 0 ]; then
        echo "❌ SSL证书生成失败"
        exit 1
    fi
fi

# 检查端口
if [ "$1" = "https" ]; then
    PORT=${HTTPS_PORT:-3443}
else
    PORT=${PORT:-3000}
fi

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  端口 $PORT 已被占用，请使用其他端口："
    if [ "$1" = "https" ]; then
        echo "   HTTPS_PORT=8443 ./deploy.sh https"
    else
        echo "   PORT=8080 ./deploy.sh"
    fi
    exit 1
fi

echo "✅ 端口 $PORT 可用"

# 获取本机IP
LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)

# 启动服务
echo "🚀 启动服务..."
echo "访问地址:"
if [ "$1" = "https" ]; then
    echo "  本地HTTPS: https://localhost:$PORT"
    if [ -n "$LOCAL_IP" ]; then
        echo "  局域网HTTPS: https://$LOCAL_IP:$PORT"
        echo "  管理后台: https://$LOCAL_IP:$PORT/admin"
        echo "  大屏展示: https://$LOCAL_IP:$PORT/ranking-display"
        echo "  扫码投票: https://$LOCAL_IP:$PORT/scan (支持摄像头)"
    fi
    echo ""
    echo "⚠️  首次访问时浏览器会显示安全警告"
    echo "   请点击'高级' → '继续访问'来接受自签名证书"
else
    echo "  本地: http://localhost:$PORT"
    if [ "$1" = "lan" ] && [ -n "$LOCAL_IP" ]; then
        echo "  局域网: http://$LOCAL_IP:$PORT"
        echo "  管理后台: http://$LOCAL_IP:$PORT/admin"
        echo "  大屏展示: http://$LOCAL_IP:$PORT/ranking-display"
    fi
fi
echo "按 Ctrl+C 停止服务"
echo ""

eval $START_SCRIPT