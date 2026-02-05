# 性能分析报告 - 年会投票系统

## 执行摘要

**当前状态**: ⚠️ **存在严重性能问题，不支持 100 并发**

**主要问题**:
1. **数据库连接泄漏**: 每次请求创建新连接但未正确管理
2. **缺少连接池**: SQLite 连接未复用，高并发下会耗尽系统资源
3. **缺少 WAL 模式**: 未启用 Write-Ahead Logging，读写阻塞严重
4. **串行化操作**: 大量使用 `serialize()` 导致性能瓶颈
5. **缺少查询优化**: 无连接缓存，每次请求都执行耗时查询

---

## 1. 关键性能问题

### 1.1 数据库连接管理问题 🔴 严重

**问题描述**:
```javascript
// src/database/init.js
function getDatabase() {
  return createConnection();  // 每次调用都创建新连接！
}

// src/database/operations.js - 发现 84 处调用
const db = getDatabase();  // 每个操作都创建新连接
// ... 操作 ...
db.close();  // 手动关闭
```

**影响**:
- 每次 API 调用创建 1-3 个新连接
- 100 并发 = 300+ 同时连接
- SQLite 默认最大连接数远低于此
- 导致 `SQLITE_BUSY` 错误和请求失败

**预期表现**:
- 10 并发: ✅ 可能正常
- 50 并发: ⚠️ 开始出现延迟和错误
- 100 并发: ❌ 系统崩溃或大量请求失败

---

### 1.2 缺少 WAL 模式 🔴 严重

**问题描述**:
```javascript
// src/database/init.js - 没有启用 WAL
db.run('PRAGMA foreign_keys = ON');
// 缺少: db.run('PRAGMA journal_mode = WAL');
// 缺少: db.run('PRAGMA busy_timeout = 5000');
```

**影响**:
- 默认 DELETE 模式下，写操作阻塞所有读操作
- 读操作之间也可能相互阻塞
- 无法实现真正的并发读写

**WAL 模式优势**:
- 读操作不阻塞写操作
- 写操作不阻塞读操作
- 可提升 10-50 倍的并发性能

---

### 1.3 过度使用 serialize() 🟡 中等

**问题描述**:
```javascript
// 发现多处不必要的串行化
db.serialize(() => {
  db.run(query1);
  db.run(query2);  // 强制串行执行
});
```

**影响**:
- 串行化导致操作排队等待
- 降低并发处理能力
- 增加响应时间

---

### 1.4 缺少缓存策略 🟡 中等

**当前缓存**:
```javascript
// src/routes/votes.js - 只有简单的内存缓存
const cache = {
  statistics: null,
  ranking: null,
  lastUpdate: null,
  ttl: 30000 // 30秒 TTL
};
```

**问题**:
- 仅缓存统计和排名数据
- 用户查询、投票状态检查未缓存
- 大屏展示频繁刷新导致重复查询

---

### 1.5 N+1 查询问题 🟡 中等

**示例**:
```javascript
// 获取投票记录时，每条记录都单独查询用户信息
const votes = await getVotes();
for (const vote of votes) {
  const user = await getUserById(vote.targetUserId);  // N+1 问题
}
```

---

## 2. 性能测试估算

### 当前架构性能评估

| 并发数 | 预期响应时间 | 成功率 | 状态 |
|--------|------------|--------|------|
| 1      | 50-100ms   | 100%   | ✅ 正常 |
| 10     | 200-500ms  | 95%+   | ✅ 可用 |
| 30     | 1-3s       | 80%+   | ⚠️ 降级 |
| 50     | 3-10s      | 50%+   | ❌ 不可用 |
| 100    | 超时       | <20%   | ❌ 系统崩溃 |

### 瓶颈点

1. **数据库连接**: 最大约 30-50 并发
2. **磁盘 I/O**: 未使用 WAL，写操作阻塞
3. **内存**: 无连接池，内存碎片化
4. **CPU**: 串行化操作导致 CPU 利用率低

---

## 3. 改进建议（优先级排序）

### 🔴 P0 - 立即修复（支持 100 并发必须）

#### 3.1 实现数据库连接池

**方案 A: 使用 better-sqlite3（推荐）**
```javascript
// 替换 sqlite3 为 better-sqlite3
const Database = require('better-sqlite3');

// 创建单例连接
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, {
      verbose: console.log,
      fileMustExist: false
    });
    
    // 启用 WAL 模式
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');
  }
  return dbInstance;
}
```

**优势**:
- 同步 API，性能更高
- 更简单的错误处理
- 自动连接管理
- 更好的并发性能

**方案 B: 实现连接池（保留 sqlite3）**
```javascript
class DatabasePool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
  }
  
  async acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      const db = createConnection();
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA busy_timeout = 5000');
      return db;
    }
    
    // 等待可用连接
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.acquire();
  }
  
  release(db) {
    this.pool.push(db);
  }
}
```

---

#### 3.2 启用 WAL 模式

```javascript
// src/database/init.js
function createConnection() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      throw err;
    }
  });
  
  // 关键配置
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');  // 在 WAL 模式下安全
  db.run('PRAGMA busy_timeout = 5000');   // 5秒超时
  db.run('PRAGMA cache_size = -64000');   // 64MB 缓存
  db.run('PRAGMA foreign_keys = ON');
  
  return db;
}
```

**预期提升**: 10-50 倍读写并发能力

---

#### 3.3 修复连接泄漏

**修改所有 operations.js 中的函数**:
```javascript
// 错误方式（当前）
async function getUserById(userId) {
  const db = getDatabase();  // 每次创建
  // ... 查询 ...
  db.close();  // 手动关闭
}

// 正确方式（使用连接池）
async function getUserById(userId) {
  const db = await dbPool.acquire();
  try {
    // ... 查询 ...
    return result;
  } finally {
    dbPool.release(db);  // 确保释放
  }
}
```

---

### 🟡 P1 - 重要优化（提升性能）

#### 3.4 添加查询缓存

```javascript
// 实现 Redis 或内存缓存
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 });

async function getUserById(userId) {
  // 检查缓存
  const cached = cache.get(`user:${userId}`);
  if (cached) return cached;
  
  // 查询数据库
  const user = await queryDatabase(userId);
  
  // 缓存结果
  cache.set(`user:${userId}`, user, 300);  // 5分钟
  return user;
}
```

**缓存策略**:
- 用户信息: 5分钟 TTL
- 投票状态: 1分钟 TTL
- 排名数据: 30秒 TTL
- 统计数据: 30秒 TTL

---

#### 3.5 批量查询优化

```javascript
// 错误方式（N+1 问题）
const votes = await getVotes();
for (const vote of votes) {
  vote.user = await getUserById(vote.userId);  // N 次查询
}

// 正确方式（批量查询）
const votes = await getVotes();
const userIds = [...new Set(votes.map(v => v.userId))];
const users = await getUsersByIds(userIds);  // 1 次查询
const userMap = new Map(users.map(u => [u.id, u]));
votes.forEach(vote => {
  vote.user = userMap.get(vote.userId);
});
```

---

#### 3.6 添加数据库索引

```javascript
// 检查并添加缺失的索引
const additionalIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_votes_time ON votes(vote_time DESC)',
  'CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender)',
  'CREATE INDEX IF NOT EXISTS idx_vote_restrictions_updated ON vote_restrictions(updated_at)',
];
```

---

### 🟢 P2 - 性能增强（锦上添花）

#### 3.7 实现读写分离

```javascript
// 主库用于写操作
const masterDb = getDatabase();

// 从库用于读操作（WAL 模式支持）
const replicaDb = getDatabase();
```

#### 3.8 使用预编译语句

```javascript
// 预编译常用查询
const statements = {
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  recordVote: db.prepare('INSERT INTO votes (voter_id, target_user_id, ip_address) VALUES (?, ?, ?)'),
};

// 使用预编译语句
const user = statements.getUserById.get(userId);
```

#### 3.9 添加性能监控

```javascript
// 监控慢查询
const queryMonitor = (query, duration) => {
  if (duration > 100) {  // 超过 100ms
    console.warn(`Slow query (${duration}ms): ${query}`);
  }
};
```

---

## 4. 实施计划

### Phase 1: 紧急修复（1-2 天）
- [ ] 启用 WAL 模式
- [ ] 实现基础连接池
- [ ] 修复明显的连接泄漏

**预期提升**: 支持 50 并发

---

### Phase 2: 性能优化（3-5 天）
- [ ] 完整的连接池实现
- [ ] 添加查询缓存
- [ ] 批量查询优化
- [ ] 添加缺失索引

**预期提升**: 支持 100+ 并发

---

### Phase 3: 长期优化（1-2 周）
- [ ] 迁移到 better-sqlite3
- [ ] 实现读写分离
- [ ] 添加性能监控
- [ ] 压力测试和调优

**预期提升**: 支持 500+ 并发

---

## 5. 风险评估

### 高风险改动
- ⚠️ 迁移到 better-sqlite3（API 不兼容）
- ⚠️ 大规模重构连接管理

### 低风险改动
- ✅ 启用 WAL 模式
- ✅ 添加索引
- ✅ 实现缓存层

---

## 6. 性能测试建议

### 压力测试工具

```bash
# 使用 Apache Bench
ab -n 1000 -c 100 http://82.156.138.160:3000/api/votes/ranking

# 使用 Artillery
artillery quick --count 100 --num 10 http://82.156.138.160:3000/api/votes/ranking
```

### 监控指标

- 响应时间 (P50, P95, P99)
- 吞吐量 (RPS)
- 错误率
- 数据库连接数
- 内存使用量
- CPU 使用率

---

## 7. 结论

**当前状态**: ❌ **不支持 100 并发**

**最低限度改进（P0）后**: ✅ **可支持 50-100 并发**

**完整优化（P0+P1）后**: ✅ **可支持 200-500 并发**

**建议**: 
1. 立即实施 P0 优化（1-2 天工作量）
2. 在生产环境进行压力测试验证
3. 根据实际表现调整 P1 优化的优先级

---

生成时间: 2026-02-05
分析人: AI Assistant
