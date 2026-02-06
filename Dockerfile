# 构建阶段 - 安装构建工具并编译
FROM node:20-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install

# 运行阶段 - 只包含运行时
FROM node:20-alpine

# 安装运行时依赖（sharp 需要 vips）
RUN apk add --no-cache vips

WORKDIR /app

# 只复制生产依赖（已编译的 node_modules）
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY . .

# 创建目录并清理缓存
RUN mkdir -p data/uploads && \
    npm cache clean --force

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
