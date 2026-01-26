#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 年会投票系统 - 生产环境启动');
console.log('================================');

// 检查必要目录
const requiredDirs = ['data', 'uploads'];
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  }
});

// 设置环境变量
process.env.NODE_ENV = 'production';
const port = process.env.PORT || 3000;

console.log(`✅ 运行环境: ${process.env.NODE_ENV}`);
console.log(`✅ 服务端口: ${port}`);

// 启动服务器
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: process.env
});

// 处理进程信号
process.on('SIGINT', () => {
  console.log('\n🛑 正在停止服务...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在停止服务...');
  server.kill('SIGTERM');
});

server.on('close', (code) => {
  console.log(`\n📋 服务已停止，退出码: ${code}`);
  process.exit(code);
});

// 显示访问信息
setTimeout(() => {
  console.log('\n🌐 访问地址:');
  console.log(`   主页: http://localhost:${port}`);
  console.log(`   管理后台: http://localhost:${port}/admin`);
  console.log(`   大屏展示: http://localhost:${port}/ranking-display`);
  console.log('\n💡 提示: 按 Ctrl+C 停止服务');
}, 2000);