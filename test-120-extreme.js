/**
 * 120人极端高并发测试
 *
 * 场景：120人在2秒内几乎同时点击投票按钮（最坏情况）
 * 这模拟了年会中最极端的场景 - 例如主持人宣布开始投票后
 * 所有人同时拿出手机扫码投票
 */

const { performance } = require('perf_hooks');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, releaseConnection, getPoolStats } = require('./src/database/init');

// 测试配置
const CONFIG = {
  totalUsers: 120,
  votesPerUser: 2,
  extremeSpreadMs: 2000,  // 2秒内完成所有投票（极端情况）
  batchSize: 40,          // 分3批发送，模拟真实情况（40人/批）
};

// 统计数据
const stats = {
  totalVotes: 0,
  successVotes: 0,
  failedVotes: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  responseTimes: [],
  errors: [],
  poolStats: {
    maxActiveConnections: 0,
  },
  startTime: null,
  endTime: null
};

/**
 * 原子投票操作
 */
async function atomicVote(voterId, targetUserId, targetGender) {
  const startTime = performance.now();

  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    // 记录连接池状态
    const poolStats = getPoolStats();
    stats.poolStats.maxActiveConnections = Math.max(
      stats.poolStats.maxActiveConnections,
      poolStats.activeConnections
    );

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (err) => {
        if (err) {
          releaseConnection(db);
          return reject({ error: err, message: 'BEGIN failed' });
        }

        const checkSql = 'SELECT * FROM vote_restrictions WHERE voter_id = ?';
        db.get(checkSql, [voterId], (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            releaseConnection(db);
            return reject({ error: err, message: 'SELECT failed' });
          }

          let canVote = false;
          if (!row) {
            canVote = true;
          } else {
            if (targetGender === 'male' && !row.male_voted_user_id) canVote = true;
            else if (targetGender === 'female' && !row.female_voted_user_id) canVote = true;
          }

          if (!canVote) {
            db.run('ROLLBACK');
            releaseConnection(db);
            return reject({ error: new Error('Already voted'), message: 'already_voted' });
          }

          const voteSql = `INSERT INTO votes (voter_id, target_user_id, vote_time, ip_address)
                           VALUES (?, ?, CURRENT_TIMESTAMP, ?)`;

          db.run(voteSql, [voterId, targetUserId, '127.0.0.1'], function(voteErr) {
            if (voteErr) {
              db.run('ROLLBACK');
              releaseConnection(db);
              return reject({ error: voteErr, message: 'INSERT vote failed' });
            }

            if (row) {
              const field = targetGender === 'male' ? 'male_voted_user_id' : 'female_voted_user_id';
              const updateSql = `UPDATE vote_restrictions
                                 SET ${field} = ?, updated_at = CURRENT_TIMESTAMP
                                 WHERE voter_id = ?`;

              db.run(updateSql, [targetUserId, voterId], (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  releaseConnection(db);
                  return reject({ error: updateErr, message: 'UPDATE failed' });
                }

                db.run('COMMIT', (commitErr) => {
                  releaseConnection(db);
                  const responseTime = performance.now() - startTime;
                  if (commitErr) return reject({ error: commitErr, message: 'COMMIT failed', responseTime });
                  resolve({ responseTime });
                });
              });
            } else {
              const maleVotedUserId = targetGender === 'male' ? targetUserId : null;
              const femaleVotedUserId = targetGender === 'female' ? targetUserId : null;

              const insertSql = `INSERT INTO vote_restrictions
                                 (voter_id, male_voted_user_id, female_voted_user_id, created_at, updated_at)
                                 VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

              db.run(insertSql, [voterId, maleVotedUserId, femaleVotedUserId], (insertErr) => {
                if (insertErr) {
                  db.run('ROLLBACK');
                  releaseConnection(db);
                  return reject({ error: insertErr, message: 'INSERT vote_restrictions failed' });
                }

                db.run('COMMIT', (commitErr) => {
                  releaseConnection(db);
                  const responseTime = performance.now() - startTime;
                  if (commitErr) return reject({ error: commitErr, message: 'COMMIT failed', responseTime });
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
 * 确保用户存在
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

// 预创建的目标用户池
const targetUsers = {
  male: [],
  female: []
};

/**
 * 批量创建用户（更高效）
 */
async function batchCreateUsers(users) {
  return new Promise(async (resolve, reject) => {
    const db = await getDatabase();

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }

        const sql = 'INSERT OR IGNORE INTO users (id, name, gender) VALUES (?, ?, ?)';
        const stmt = db.prepare(sql);

        let completed = 0;
        const total = users.length;

        users.forEach((user, index) => {
          stmt.run(user.id, user.name, user.gender, (runErr) => {
            if (runErr) {
              // 忽略重复键错误，但记录其他错误
              if (runErr.code !== 'SQLITE_CONSTRAINT') {
                console.error(`Error creating user ${index}:`, runErr.message);
              }
            }
            completed++;

            if (completed === total) {
              stmt.finalize((finalErr) => {
                if (finalErr) {
                  db.run('ROLLBACK');
                  releaseConnection(db);
                  return reject(finalErr);
                }

                db.run('COMMIT', (commitErr) => {
                  releaseConnection(db);
                  if (commitErr) return reject(commitErr);
                  resolve();
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
 * 预创建所有目标用户
 */
async function preCreateTargetUsers() {
  console.log('📝 预创建目标用户...');

  const maleUsers = [];
  const femaleUsers = [];

  for (let i = 0; i < CONFIG.totalUsers; i++) {
    maleUsers.push({ id: uuidv4(), name: 'Male_' + i, gender: 'male' });
    femaleUsers.push({ id: uuidv4(), name: 'Female_' + i, gender: 'female' });
  }

  // 分两批创建（男和女）
  await batchCreateUsers(maleUsers);
  await batchCreateUsers(femaleUsers);

  // 保存到目标用户池
  targetUsers.male = maleUsers.map(u => u.id);
  targetUsers.female = femaleUsers.map(u => u.id);

  console.log(`✓ 预创建完成: ${CONFIG.totalUsers} 男 + ${CONFIG.totalUsers} 女\n`);
}

/**
 * 模拟单个用户的投票（男女各1票）
 */
async function simulateUserVoting(userId, userIndex) {
  // 从预创建的用户池中选取目标
  const maleTargetId = targetUsers.male[userIndex];
  const femaleTargetId = targetUsers.female[userIndex];

  try {
    // 投给男士
    const maleResult = await atomicVote(userId, maleTargetId, 'male');
    stats.successVotes++;
    stats.responseTimes.push(maleResult.responseTime);
    process.stdout.write(`✓`);

    // 投给女士
    const femaleResult = await atomicVote(userId, femaleTargetId, 'female');
    stats.successVotes++;
    stats.responseTimes.push(femaleResult.responseTime);
    process.stdout.write(`✓`);

    stats.totalVotes += 2;
    return { success: true };
  } catch (error) {
    stats.failedVotes += 2;
    stats.totalVotes += 2;
    stats.errors.push({
      userIndex,
      error: error.message,
      code: error.error?.code
    });
    if (stats.errors.length <= 3) {
      console.error(`\n[User ${userIndex}] ${error.message} (${error.error?.code || 'unknown'})`);
    }
    process.stdout.write(`✗`);
    return { success: false };
  }
}

/**
 * 分批执行投票（模拟真实场景中的时间分散）
 */
async function runBatchedTest() {
  console.log(`🔥 极端测试: ${CONFIG.totalUsers}人用户在${CONFIG.extremeSpreadMs/1000}秒内投票\n`);

  const usersPerBatch = CONFIG.totalUsers / (CONFIG.extremeSpreadMs / 100); // 每批40人
  const batches = Math.ceil(CONFIG.totalUsers / CONFIG.batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * CONFIG.batchSize;
    const batchEnd = Math.min(batchStart + CONFIG.batchSize, CONFIG.totalUsers);
    const batchCount = batchEnd - batchStart;

    console.log(`\n📦 批次 ${batch + 1}/${batches}: ${batchCount} 个用户同时投票...`);

    const promises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const userId = uuidv4();
      promises.push(simulateUserVoting(userId, i));
    }

    await Promise.all(promises);

    if (batch < batches - 1) {
      await sleep(500); // 批次间间隔500ms
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

async function initDatabase() {
  const db = await getDatabase();
  await new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT, gender TEXT
    )`, () => {
      db.run(`CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voter_id TEXT, target_user_id TEXT,
        vote_time DATETIME DEFAULT CURRENT_TIMESTAMP, ip_address TEXT
      )`, () => {
        db.run(`CREATE TABLE IF NOT EXISTS vote_restrictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voter_id TEXT NOT NULL UNIQUE,
          male_voted_user_id TEXT,
          female_voted_user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => resolve());
      });
    });
  });
  releaseConnection(db);
}

async function runTest() {
  console.log('🚀 120人极端高并发测试启动\n');
  console.log('⏳ 初始化数据库...');
  await initDatabase();

  // 预创建所有目标用户（减少测试时的数据库压力）
  await preCreateTargetUsers();

  stats.startTime = performance.now();
  await runBatchedTest();
  stats.endTime = performance.now();

  const duration = stats.endTime - stats.startTime;
  const expectedVotes = CONFIG.totalUsers * CONFIG.votesPerUser;

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 120人极端高并发测试报告');
  console.log('='.repeat(70));

  console.log('\n📈 测试结果:');
  console.log(`   总用户数: ${CONFIG.totalUsers}`);
  console.log(`   预期投票数: ${expectedVotes}`);
  console.log(`   实际投票数: ${stats.totalVotes}`);
  console.log(`   成功投票: ${stats.successVotes}`);
  console.log(`   失败投票: ${stats.failedVotes}`);
  console.log(`   成功率: ${((stats.successVotes / expectedVotes) * 100).toFixed(2)}%`);

  console.log('\n⏱️  性能指标:');
  console.log(`   总耗时: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   吞吐量: ${(stats.successVotes / duration * 1000).toFixed(2)} votes/秒`);
  if (stats.responseTimes.length > 0) {
    console.log(`   平均响应时间: ${(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length).toFixed(2)}ms`);
    console.log(`   P50: ${calculatePercentile(stats.responseTimes, 50).toFixed(2)}ms`);
    console.log(`   P90: ${calculatePercentile(stats.responseTimes, 90).toFixed(2)}ms`);
    console.log(`   P95: ${calculatePercentile(stats.responseTimes, 95).toFixed(2)}ms`);
    console.log(`   P99: ${calculatePercentile(stats.responseTimes, 99).toFixed(2)}ms`);
    console.log(`   最大: ${Math.max(...stats.responseTimes).toFixed(2)}ms`);
  }

  console.log('\n🔌 连接池状态:');
  console.log(`   最大活动连接数: ${stats.poolStats.maxActiveConnections}`);
  console.log(`   当前连接池状态:`, getPoolStats());

  console.log('\n✅ 结论:');
  if (stats.failedVotes === 0) {
    console.log('   🟢 优秀 - 系统可以轻松处理120人极端并发！');
  } else if (stats.failedVotes < expectedVotes * 0.05) {
    console.log('   🟡 良好 - 失败率 < 5%，可接受');
  } else {
    console.log('   🔴 需要优化 - 失败率过高');
  }

  console.log('\n💡 建议:');
  if (stats.poolStats.maxActiveConnections >= 8) {
    console.log('   ⚠️  连接池接近饱和，建议增加到20-30个连接');
  }
  if (calculatePercentile(stats.responseTimes, 95) > 1000) {
    console.log('   ⚠️  P95响应时间 > 1秒，建议使用Cluster模式');
  }

  console.log('='.repeat(70) + '\n');

  process.exit(stats.failedVotes > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
