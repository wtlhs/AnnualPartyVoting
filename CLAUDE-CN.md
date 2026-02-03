# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## ⚠️ 重要：文档维护规则

**每次对此代码仓库进行代码修改时，必须更新本文档以反映最新的代码逻辑。**

- 保持文档与实际代码库同步
- 添加/删除文件时更新架构描述
- 引入新模式、函数或工作流时记录下来
- 弃用功能时删除过时信息
- 这确保未来的 Claude Code 实例能够高效工作，避免混淆

## 项目概述

Annual Party Voting (年会最佳服装评选) 是一个用于年会投票的 H5 移动端 Web 应用程序。用户可以注册参与者、扫描二维码进行投票，并查看实时排名。应用程序支持局域网和 HTTPS 部署模式，使用 SQLite 数据库持久化。

## 开发命令

```bash
# 开发
npm run dev              # 启动开发服务器，支持自动重载（nodemon）

# 生产环境
npm start                # 在 3000 端口启动 HTTP 服务器
npm run start:lan        # 启动局域网访问服务器
npm run start:https      # 启动 HTTPS 服务器
npm run start:prod       # 启动生产服务器

# 构建 / 类型检查
npm run build            # 编译 TypeScript
npm run build:watch      # TypeScript 编译监视模式
npm run type-check       # 仅进行类型检查，不生成文件

# 测试
npm test                 # 运行所有测试
npm run test:watch       # 以监视模式运行测试
npm run test:coverage    # 运行测试并生成覆盖率报告
npm run test:types       # 运行类型检查（type-check 的别名）

# 部署
npm run deploy           # 安装并启动生产服务器
npm run deploy:lan       # 部署局域网访问
npm run deploy:https     # 生成 SSL 证书并启动 HTTPS 服务器
npm run generate-ssl     # 生成自签名 SSL 证书
```

## 架构

### 数据库层 (`src/database/`)

**核心数据库文件：**
- **init.js** - 数据库初始化、连接管理和模式创建。启动时先运行旧版迁移系统，再运行新版迁移系统。数据库文件：`data/voting.db`
- **operations.js** - 核心数据库操作，约 1400 行代码，涵盖：
  - 用户 CRUD（创建、读取、更新、删除，数字 ID 生成带重试逻辑）
  - 投票操作（atomicVote 保证并发安全，recordVote）
  - 投票限制（每个投票者每种性别可投一票：男/女）
  - 统计、排名、最近投票、投票进度
  - 数据管理（clearAllData、createDataBackup、archiveAndClearData、getDatabaseInfo）

**管理器类：**
- **VotingSettingsManager.js** - 管理投票设置，带 5 分钟内存缓存：
  - `voting_enabled` - 启用/禁用投票
  - `voting_start_time` / `voting_end_time` - 时间限制
  - `voting_message` - 投票禁用时的自定义消息
  - `max_votes_per_user` - 每用户最大投票数（默认：2）
  - `allow_self_vote` - 允许自投票（默认：false）

- **VoteRecordManager.js** - 投票记录管理，支持筛选（状态、投票者、候选人、日期范围、投票方式）、分页和状态跟踪

- **DataExportManager.js** - CSV/Excel 导出功能，支持异步任务跟踪

- **AuditLogManager.js** - 管理员操作日志记录，包含 IP 地址和用户代理跟踪

**迁移系统：**
- **migrationRunner.js** - 数据库迁移系统，带版本跟踪和 `migrations` 表
- **migrations/** - 模式迁移文件（001-005）：
  - 001: 扩展 votes 表，添加 status、user_agent、vote_method 字段
  - 002: 创建 audit_logs 表
  - 003: 创建 export_tasks 表用于异步导出任务
  - 004: 创建 voting_settings 表
  - 005: 更新 audit_logs 表以支持系统操作

**数据库模式：**
- `users` - id (UUID)、numeric_id（6位数字，唯一）、name、gender、avatar_url、qr_code、时间戳
- `votes` - id、voter_id、target_user_id、vote_time、ip_address、status、user_agent、vote_method
- `vote_restrictions` - voter_id（唯一）、male_voted_user_id、female_voted_user_id、时间戳
- `audit_logs` - id、vote_id、admin_id、operation、reason、metadata（JSON）、created_at
- `export_tasks` - id、task_type、status、filters、file_path、created_by、时间戳
- `voting_settings` - setting_key（唯一）、setting_value、description、updated_at
- `migrations` - id、filename、description、applied_at

### 路由层 (`src/routes/`)

- **users.js** - 用户注册（生成 UUID + 6 位数字 ID，带冲突重试）、二维码生成、个人资料管理、头像上传
- **votes.js** - 投票操作，统计/排名使用 30 秒内存缓存。检查投票状态、自投票限制、基于性别的投票限制（每投票者 1 男 + 1 女）
- **admin.js** - 管理面板，带身份验证、用户管理、带筛选的投票记录管理、数据导出（CSV/Excel）、数据库操作
- **voting-settings.js** - 管理员设置：投票启用/禁用、时间限制、自定义消息
- **pages.js** - 静态 HTML 页面服务

### 中间件 (`src/middleware/`)

- **adminAuth.js** - 管理员身份验证，使用 `ADMIN_PASSWORD_HASH` 环境变量（bcrypt 哈希）

### 工具类 (`src/utils/`)

- **qrcode.js** - 使用 `qrcode` 库生成二维码
- **fileManager.js** - 文件上传/下载管理、头像备份和清理
- **exportCleanupService.js** - 导出数据文件的定期清理（启动时运行）

### 前端 (`public/`)

响应式移动优先的静态 HTML 页面：
- `index.html` - 主页，带注册功能
- `vote.html` - 投票页面，带性别选择
- `scan.html` - 二维码扫描器（基于摄像头）
- `admin.html` - 管理面板，带身份验证
- `ranking-display.html` - 实时排名展示（自动刷新）
- `profile.html`、`user-list.html`、`vote-records.html`、`mobile-stats.html`

## 核心模式

### 数据库操作

- **连接模式**：始终使用 `src/database/init.js` 中的 `getDatabase()` 获取数据库连接
- **连接管理**：连接**不会**自动关闭 - 完成后需要手动使用 `db.close()` 关闭
- **数字 ID 生成**：6 位随机 ID，带 10 次重试逻辑确保唯一性（operations.js:50-101）
- **旧版迁移系统**：使用 `PRAGMA table_info()` 检查 `numeric_id` 列，如果缺失则添加（init.js:136-190）

### 投票流程

1. 用户通过 `/api/users` 注册 → 获得 UUID（v4）和 numeric_id（6 位数字）
2. 生成二维码，URL：`https://domain/vote.html?code=<numeric_id>`
3. 其他用户扫描二维码 → 重定向到投票页面
4. 投票提交到 `/api/votes` → 根据限制验证：
   - 检查 `votingSettings.getVotingStatus()` 确认启用/时间限制
   - 检查 voter != target（禁止自投票）
   - 通过 `canVoteForGender()` 检查基于性别的限制（每投票者最多 1 男 + 1 女）
5. 使用 `atomicVote()` 进行并发安全的投票，使用事务（operations.js:570-723）
6. 写入操作时使缓存失效

### 缓存策略

- **投票统计/排名**：`src/routes/votes.js:20-38` 中的 30 秒内存缓存
  - 缓存存储：`statistics`、`ranking`、`lastUpdate`、`ttl: 30000`
  - 失效时机：投票操作、设置更改
- **投票设置**：`VotingSettingsManager.js:13-15` 中的 5 分钟缓存
  - `settingsCache` Map，`cacheExpiry: 5 * 60 * 1000`
  - 失效时机：设置更新、通过 `refreshCache()` 刷新

### 速率限制（server.js）

- **一般请求**：每个 IP 每 15 分钟 500 次请求
- **投票 API**：每个 IP 每 5 分钟 50 次请求
- **展示/只读 API**（统计、排名）：每分钟 100 次请求
- **静态文件**：无速率限制

### 安全与局域网支持

- **Helmet.js**：为局域网访问配置，禁用 HSTS、COOP、CORP
- **协议检测中间件**（server.js:54-66）：检测到 HTTP 服务器的 HTTPS 请求时重定向到协议修复页面
- **CORS**：基于 `NODE_ENV` 启用（生产环境允许特定来源）

### 测试

- **框架**：Jest + ts-jest 用于 TypeScript
- **测试位置**：与源文件并列，使用 `.test.js` 后缀（如 `adminAuth.test.js`）
- **覆盖率**：使用 `npm run test:coverage` 运行 - 排除 `.d.ts` 和测试文件
- **超时**：jest.config.js 中配置为 10 秒

## 环境配置

- `PORT` - 服务器端口（默认：3000）
- `ADMIN_PASSWORD_HASH` - 用于身份验证的管理员密码哈希（bcrypt）
- `NODE_ENV` - 设置为 'production' 以使用生产环境 CORS 设置

## 目录结构

```
AnnualPartyVoting/
├── data/                      # 数据库目录（自动创建）
│   └── voting.db             # SQLite 数据库文件
├── exports/                   # 导出的数据文件
├── uploads/                   # 用户头像上传
├── public/                    # 静态前端文件
│   ├── index.html            # 主页
│   ├── vote.html             # 投票页面
│   ├── admin.html            # 管理面板
│   └── ...
├── src/
│   ├── database/
│   │   ├── init.js           # 数据库初始化
│   │   ├── operations.js     # 核心数据库操作（~1400 行）
│   │   ├── VotingSettingsManager.js
│   │   ├── VoteRecordManager.js
│   │   ├── DataExportManager.js
│   │   ├── AuditLogManager.js
│   │   ├── migrationRunner.js
│   │   └── migrations/       # 迁移文件 001-005
│   ├── routes/
│   │   ├── users.js
│   │   ├── votes.js          # 投票 API，30秒缓存
│   │   ├── admin.js
│   │   ├── voting-settings.js
│   │   └── pages.js
│   ├── middleware/
│   │   └── adminAuth.js      # 管理员身份验证
│   └── utils/
│       ├── qrcode.js
│       ├── fileManager.js
│       └── exportCleanupService.js
├── server.js                  # 主 HTTP 服务器
├── server-lan.js             # 局域网访问服务器
├── server-https.js           # HTTPS 服务器
├── start-production.js       # 生产启动器
└── generate-ssl-fixed.js     # SSL 证书生成
```

## 部署说明

- **Docker**：使用 `node:18-alpine` 基础镜像，包含 sqlite3 原生依赖
- **数据库**：SQLite 启用 WAL 模式以获得更好的并发性能
- **文件持久化**：数据库在 `data/voting.db`，上传在 `uploads/`，导出在 `exports/`
- **协议处理**：特殊中间件处理局域网访问时的 HTTPS 到 HTTP 重定向问题
- **清理**：导出清理服务在启动时运行，删除旧的导出文件

## 数据完整性

- **外键**：启用 `PRAGMA foreign_keys = ON`
- **事务**：在 `atomicVote()` 中使用，确保并发投票安全
- **索引**：在 voter_id、target_user_id、numeric_id 上创建索引以提升查询性能
- **迁移跟踪**：所有迁移在 `migrations` 表中跟踪，防止重复执行
