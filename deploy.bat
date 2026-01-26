@echo off
echo 🚀 年会投票系统 - 一键部署脚本
echo ==================================

REM 检查部署模式
if "%1"=="https" (
    echo 🔐 HTTPS部署模式（支持摄像头）
    set START_SCRIPT=npm run start:https
    set PORT_VAR=HTTPS_PORT
    set DEFAULT_PORT=3443
) else if "%1"=="lan" (
    echo 🌐 局域网部署模式
    set START_SCRIPT=npm run start:lan
    set PORT_VAR=PORT
    set DEFAULT_PORT=3000
) else (
    echo 💻 本地部署模式
    set START_SCRIPT=npm start
    set PORT_VAR=PORT
    set DEFAULT_PORT=3000
)

REM 检查Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装，请先安装 Node.js 16+
    pause
    exit /b 1
)

echo ✅ Node.js 已安装

REM 检查npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm 未安装
    pause
    exit /b 1
)

echo ✅ npm 已安装

REM 安装依赖
echo 📦 安装依赖...
npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

echo ✅ 依赖安装完成

REM 创建必要目录
if not exist "data" mkdir data
if not exist "uploads" mkdir uploads
if not exist "ssl" mkdir ssl
echo ✅ 创建必要目录

REM 如果是HTTPS模式，生成SSL证书
if "%1"=="https" (
    echo 🔐 生成SSL证书...
    node create-ssl-simple.js
    if %errorlevel% neq 0 (
        echo ❌ SSL证书生成失败
        pause
        exit /b 1
    )
)

REM 获取本机IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP: =%

REM 启动服务
echo 🚀 启动服务...
echo 访问地址:
if "%1"=="https" (
    echo   本地HTTPS: https://localhost:%DEFAULT_PORT%
    echo   局域网HTTPS: https://%LOCAL_IP%:%DEFAULT_PORT%
    echo   管理后台: https://%LOCAL_IP%:%DEFAULT_PORT%/admin
    echo   大屏展示: https://%LOCAL_IP%:%DEFAULT_PORT%/ranking-display
    echo   扫码投票: https://%LOCAL_IP%:%DEFAULT_PORT%/scan （支持摄像头）
    echo.
    echo ⚠️  首次访问时浏览器会显示安全警告
    echo    请点击'高级' → '继续访问'来接受自签名证书
) else (
    echo   本地: http://localhost:%DEFAULT_PORT%
    if "%1"=="lan" (
        echo   局域网: http://%LOCAL_IP%:%DEFAULT_PORT%
        echo   管理后台: http://%LOCAL_IP%:%DEFAULT_PORT%/admin
        echo   大屏展示: http://%LOCAL_IP%:%DEFAULT_PORT%/ranking-display
    )
)
echo 按 Ctrl+C 停止服务
echo.

%START_SCRIPT%