@echo off
echo 🐳 年会投票系统 - Docker镜像构建脚本
echo =====================================

REM 检查Docker是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker未安装或未启动
    echo 请先安装Docker Desktop for Windows
    pause
    exit /b 1
)

echo ✅ Docker已安装
echo.

REM 构建Docker镜像
echo 📦 开始构建Docker镜像...
docker build -t annual-party-voting:latest .

if %errorlevel% neq 0 (
    echo ❌ Docker镜像构建失败
    pause
    exit /b 1
)

echo ✅ Docker镜像构建成功
echo.

REM 显示镜像信息
echo 📋 镜像信息：
docker images | findstr annual-party-voting
echo.

REM 创建数据目录
echo 📁 创建本地数据目录...
if not exist "data" mkdir data
if not exist "uploads" mkdir uploads
echo ✅ 数据目录创建完成
echo.

REM 测试运行
echo 🚀 是否要测试运行容器？ (Y/N)
set /p choice=请选择: 

if /i "%choice%"=="Y" (
    echo 🧪 开始测试运行...
    
    REM 停止已存在的测试容器
    docker stop annual-party-voting-test 2>nul
    docker rm annual-party-voting-test 2>nul
    
    REM 运行测试容器
    docker run -d -p 3000:3000 -v "%cd%/data":/app/data -v "%cd%/uploads":/app/uploads --name annual-party-voting-test annual-party-voting:latest
    
    if %errorlevel% neq 0 (
        echo ❌ 容器启动失败
        pause
        exit /b 1
    )
    
    echo ✅ 容器启动成功
    echo 🌐 访问地址: http://localhost:3000
    echo 📝 查看日志: docker logs annual-party-voting-test
    echo 🛑 停止容器: docker stop annual-party-voting-test
    echo.
)

echo 🎉 Docker镜像构建完成！
echo 📖 查看完整指南: DATABASE_PERSISTENCE_GUIDE.md
echo.
pause