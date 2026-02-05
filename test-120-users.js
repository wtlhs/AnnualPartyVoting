/**
 * 120人同时使用系统的压力测试
 *
 * 场景描述：
 * - 120人同时使用系统
 * - 每人需要投票（男士1票 + 女士1票 = 2票/人）
 * - 总共240个投票操作
 * - 模拟真实场景：不是所有人完全同时点击，而是在30秒内陆续投票
 *
 * 测试目标：
 * 1. 验证系统是否能稳定处理120并发用户
 * 2. 检查响应时间是否在可接受范围内（< 2秒）
 * 3. 确保没有数据库锁或连接池耗尽问题
 * 4. 测试连接池在高并发下的表现
 */

const { performance } = require('perf_hooks');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, releaseConnection, getPoolStats } = require('./src/database/init');

// 测试配置
const CONFIG = {
  totalUsers: 120,           // 总用户数
  votesPerUser: 2,           // 每用户投票数（男女各1）
  spreadTimeMs: 30000,       // 投票分散在30秒内
  thinkTimeMs: 2000,         // 用户操作间隔（看页面、思考等）
  testTimeoutMs: 120000      // 测试超时时间（2分钟）
};

// 统计数据
const stats = {
  totalVotes: 0,
  successVotes: 0,
  failedVotes: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  totalResponseTime: 0,
  responseTimes: [],
  errors: [],
  poolStats: {
    snapshots: [],
    maxActiveConnections: 0,
    maxAvailableConnections: 0
  },
  startTime: null,
  endTime: null
};

/**
 * 模拟真实的投票操作（使用原子投票事务）
 */
async function simulateRealVote(voterId, targetUserId, targetGender) {
  const startTime = performance.now();

  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    // 记录连接池状态
    const poolStats = getPoolStats();
    stats.poolStats.maxActiveConnections = Math.max(
      stats.poolStats.maxActiveConnections,
      poolStats.activeConnections
    );
    stats.poolStats.maxAvailableConnections = Math.max(
      stats.poolStats.maxAvailableConnections,
      poolStats.availableConnections
    );

    db.serialize(() => {
      // 开始事务
      db.run('BEGIN IMMEDIATE TRANSACTION', (err) => {
        if (err) {
          releaseConnection(db);
          return reject({ error: err, message: 'BEGIN failed' });
        }

        // 检查投票限制
        const checkSql = 'SELECT * FROM vote_restrictions WHERE voter_id = ?';
        db.get(checkSql, [voterId], (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            releaseConnection(db);
            return reject({ error: err, message: 'SELECT vote_restrictions failed' });
          }

          // 检查是否已为该性别投票
          let canVote = false;
          if (!row) {
            canVote = true;
          } else {
            if (targetGender === 'male' && !row.male_voted_user_id) {
              canVote = true;
            } else if (targetGender === 'female' && !row.female_voted_user_id) {
              canVote = true;
            }
          }

          if (!canVote) {
            db.run('ROLLBACK');
            releaseConnection(db);
            return reject({
              error: new Error('Already voted for this gender'),
              message: 'already_voted'
            });
          }

          // 插入投票记录
          const voteSql = `
            INSERT INTO votes (voter_id, target_user_id, vote_time, ip_address)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
          `;

          db.run(voteSql, [voterId, targetUserId, '127.0.0.1'], function(voteErr) {
            if (voteErr) {
              db.run('ROLLBACK');
              releaseConnection(db);
              return reject({ error: voteErr, message: 'INSERT vote failed' });
            }

            // 更新或创建投票限制记录
            if (row) {
              const field = targetGender === 'male' ? 'male_voted_user_id' : 'female_voted_user_id';
              const updateSql = `
                UPDATE vote_restrictions
                SET ${field} = ?, updated_at = CURRENT_TIMESTAMP
                WHERE voter_id = ?
              `;

              db.run(updateSql, [targetUserId, voterId], (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  releaseConnection(db);
                  return reject({ error: updateErr, message: 'UPDATE vote_restrictions failed' });
                }

                db.run('COMMIT', (commitErr) => {
                  releaseConnection(db);
                  const responseTime = performance.now() - startTime;
                  if (commitErr) {
                    return reject({ error: commitErr, message: 'COMMIT failed', responseTime });
                  }
                  resolve({ responseTime });
                });
              });
            } else {
              const maleVotedUserId = targetGender === 'male' ? targetUserId : null;
              const femaleVotedUserId = targetGender === 'female' ? targetUserId : null;

              const insertSql = `
                INSERT INTO vote_restrictions (voter_id, male_voted_user_id, female_voted_user_id, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `;

              db.run(insertSql, [voterId, maleVotedUserId, femaleVotedUserId], (insertErr) => {
                if (insertErr) {
                  db.run('ROLLBACK');
                  releaseConnection(db);
                  return reject({ error: insertErr, message: 'INSERT vote_restrictions failed' });
                }

                db.run('COMMIT', (commitErr) => {
                  releaseConnection(db);
                  const responseTime = performance.now() - startTime;
                  if (commitErr) {
                    return reject({ error: commitErr, message: 'COMMIT failed', responseTime });
                  }
                  resolve({ responseTime });
                });
              });
            }
          });
        });
      });
    });
  });
}

/**
 * 创建用户记录（确保外键约束不失败）
 */
async function ensureUserExists(userId, name, gender) {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();
    db.run('INSERT OR IGNORE INTO users (id, name, gender) VALUES (?, ?, ?)', [userId, name, gender], (err) => {
      releaseConnection(db);
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * 模拟单个用户的投票行为
 */
async function simulateUserVoting(userId, userIndex) {
  const userResults = {
    userId,
    userIndex,
    votes: [],
    errors: []
  };

  // 为用户创建一个随机的投票时间偏移（模拟真实场景中的时间分散）
  const randomDelay = Math.random() * CONFIG.spreadTimeMs;
  await sleep(randomDelay);

  // 用户投票：先投男士，再投女士（中间有思考时间）
  const maleTargetId = uuidv4();
  const femaleTargetId = uuidv4();

  // 确保目标用户存在于users表中（否则外键约束会失败）
  await ensureUserExists(maleTargetId, 'MaleTarget_' + maleTargetId.slice(0, 8), 'male');
  await ensureUserExists(femaleTargetId, 'FemaleTarget_' + femaleTargetId.slice(0, 8), 'female');

  try {
    // 投给男士
    const maleVoteStart = performance.now();
    const maleResult = await simulateRealVote(userId, maleTargetId, 'male');
    stats.successVotes++;
    stats.responseTimes.push(maleResult.responseTime);
    userResults.votes.push({
      gender: 'male',
      targetId: maleTargetId,
      responseTime: maleResult.responseTime
    });
    process.stdout.write(`✓`);

    // 模拟思考时间
    await sleep(Math.random() * CONFIG.thinkTimeMs);

    // 投给女士
    const femaleVoteStart = performance.now();
    const femaleResult = await simulateRealVote(userId, femaleTargetId, 'female');
    stats.successVotes++;
    stats.responseTimes.push(femaleResult.responseTime);
    userResults.votes.push({
      gender: 'female',
      targetId: femaleTargetId,
      responseTime: femaleResult.responseTime
    });
    process.stdout.write(`✓`);

  } catch (error) {
    stats.failedVotes++;
    stats.totalVotes++;
    userResults.errors.push(error);
    stats.errors.push({
      userId,
      userIndex,
      error: error.message || error.error?.message,
      errorMessage: error.error?.message,
      errorCode: error.error?.code,
      details: error
    });
    // 只在前面几个错误时打印详细错误
    if (stats.errors.length <= 5) {
      console.error(`\n   [User ${userIndex}] Error: ${error.message}`, error.error ? `(${error.error.message})` : '');
    }
    process.stdout.write(`✗`);
  }

  // 每个用户有2票，所以增加2
  stats.totalVotes += 2;
  return userResults;
}

/**
 * 定期记录连接池状态
 */
function startPoolStatsMonitoring() {
  const interval = setInterval(() => {
    const poolStats = getPoolStats();
    stats.poolStats.snapshots.push({
      time: Date.now() - stats.startTime,
      ...poolStats
    });
  }, 1000); // 每秒记录一次

  return interval;
}

/**
 * 辅助函数：睡眠
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算百分位数
 */
function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * 打印测试报告
 */
function printReport() {
  const duration = stats.endTime - stats.startTime;
  const avgResponseTime = stats.totalResponseTime / stats.totalVotes;
  const throughput = (stats.successVotes / duration) * 1000; // votes per second

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 120人同时使用系统 - 压力测试报告');
  console.log('='.repeat(70));

  console.log('\n📈 测试结果汇总:');
  console.log(`   总用户数: ${CONFIG.totalUsers}`);
  console.log(`   总投票数: ${stats.totalVotes} (预期 ${CONFIG.totalUsers * CONFIG.votesPerUser})`);
  console.log(`   成功投票: ${stats.successVotes}`);
  console.log(`   失败投票: ${stats.failedVotes}`);
  console.log(`   成功率: ${((stats.successVotes / stats.totalVotes) * 100).toFixed(2)}%`);

  console.log('\n⏱️  性能指标:');
  console.log(`   总耗时: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   吞吐量: ${throughput.toFixed(2)} votes/秒`);
  console.log(`   平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   最小响应时间: ${stats.minResponseTime.toFixed(2)}ms`);
  console.log(`   最大响应时间: ${stats.maxResponseTime.toFixed(2)}ms`);
  console.log(`   P50 响应时间: ${calculatePercentile(stats.responseTimes, 50).toFixed(2)}ms`);
  console.log(`   P90 响应时间: ${calculatePercentile(stats.responseTimes, 90).toFixed(2)}ms`);
  console.log(`   P95 响应时间: ${calculatePercentile(stats.responseTimes, 95).toFixed(2)}ms`);
  console.log(`   P99 响应时间: ${calculatePercentile(stats.responseTimes, 99).toFixed(2)}ms`);

  console.log('\n🔌 连接池状态:');
  console.log(`   最大活动连接数: ${stats.poolStats.maxActiveConnections}`);
  console.log(`   最大可用连接数: ${stats.poolStats.maxAvailableConnections}`);
  const finalPoolStats = getPoolStats();
  console.log(`   当前总连接数: ${finalPoolStats.totalConnections}`);
  console.log(`   当前活动连接: ${finalPoolStats.activeConnections}`);
  console.log(`   当前可用连接: ${finalPoolStats.availableConnections}`);

  console.log('\n✅ 系统评估:');
  if (stats.failedVotes === 0 && avgResponseTime < 1000) {
    console.log('   🟢 优秀 - 系统可以轻松处理120人同时使用！');
  } else if (stats.failedVotes === 0 && avgResponseTime < 2000) {
    console.log('   🟡 良好 - 系统能够处理120人，但响应时间稍慢');
  } else if (stats.failedVotes < stats.totalVotes * 0.05) {
    console.log('   🟠 可接受 - 系统基本稳定，但有少量失败（< 5%）');
  } else {
    console.log('   🔴 需要优化 - 系统在高并发下表现不稳定');
  }

  // 性能建议
  console.log('\n💡 优化建议:');
  if (stats.poolStats.maxActiveConnections >= finalPoolStats.maxConnections * 0.8) {
    console.log('   ⚠️  连接池使用率超过80%，建议增加 maxConnections');
  }
  if (calculatePercentile(stats.responseTimes, 95) > 2000) {
    console.log('   ⚠️  P95响应时间超过2秒，建议使用Cluster模式或多实例部署');
  }
  if (stats.maxResponseTime > 5000) {
    console.log('   ⚠️  最大响应时间超过5秒，可能存在数据库锁或连接等待问题');
  }

  // 错误详情
  if (stats.errors.length > 0) {
    console.log('\n❌ 错误详情 (前10个):');
    stats.errors.slice(0, 10).forEach((err, i) => {
      console.log(`   ${i + 1}. User[${err.userIndex}]: ${err.details.message}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... 还有 ${stats.errors.length - 10} 个错误`);
    }
  }

  console.log('='.repeat(70));
}

/**
 * 主测试函数
 */
async function runTest() {
  console.log('🚀 启动120人同时使用系统压力测试...\n');

  // 初始化数据库（确保表结构正确）
  console.log('📋 初始化数据库...');
  const db = await getDatabase();
  await new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      gender TEXT
    )`, () => {
      db.run(`CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT,
        target_user_id TEXT,
        vote_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
      )`, () => {
        db.run(`CREATE TABLE IF NOT EXISTS vote_restrictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voter_id TEXT NOT NULL UNIQUE,
          male_voted_user_id TEXT,
          female_voted_user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
          resolve();
        });
      });
    });
  });
  releaseConnection(db);

  // 开始测试
  stats.startTime = performance.now();
  console.log(`\n📊 测试配置:`);
  console.log(`   用户数: ${CONFIG.totalUsers}`);
  console.log(`   每用户投票数: ${CONFIG.votesPerUser}`);
  console.log(`   预计总投票数: ${CONFIG.totalUsers * CONFIG.votesPerUser}`);
  console.log(`   投票时间分散: ${(CONFIG.spreadTimeMs / 1000).toFixed(1)}秒`);
  console.log(`\n⏳ 开始测试... (进度: `);

  // 启动连接池监控
  const monitoringInterval = startPoolStatsMonitoring();

  // 创建所有用户的投票任务
  const userPromises = [];
  for (let i = 0; i < CONFIG.totalUsers; i++) {
    const userId = uuidv4();
    userPromises.push(simulateUserVoting(userId, i));
  }

  // 等待所有用户完成
  await Promise.all(userPromises);

  // 停止监控
  clearInterval(monitoringInterval);
  stats.endTime = performance.now();

  console.log(') 完成!\n');

  // 打印报告
  printReport();

  // 清理并退出
  process.exit(stats.failedVotes > 0 ? 1 : 0);
}

// 运行测试
runTest().catch(err => {
  console.error('\n❌ 测试执行失败:', err);
  process.exit(1);
});
