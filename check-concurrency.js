
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data/voting.db');

// 模拟 atomicVote 逻辑，但不依赖整个项目结构，只测试数据库部分
function atomicVoteSim(db, voterId, targetUserId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (err) => {
        if (err) return reject(err);

        // 模拟一些查询和写入
        db.get('SELECT * FROM users WHERE id = ?', [voterId], (err, row) => {
            if (err) {
                db.run('ROLLBACK');
                return reject(err);
            }
            
            db.run('INSERT INTO votes (voter_id, target_user_id, vote_time) VALUES (?, ?, CURRENT_TIMESTAMP)', 
                [voterId, targetUserId], 
                (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    
                    db.run('COMMIT', (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                }
            );
        });
      });
    });
  });
}

// 每次请求创建新连接（模拟现状）
function voteWithNewConnection(voterId, targetUserId) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        // 默认没有 busy_timeout
        atomicVoteSim(db, voterId, targetUserId)
            .then(() => {
                db.close();
                resolve();
            })
            .catch(err => {
                db.close();
                reject(err);
            });
    });
}

async function runTest() {
    console.log('Starting concurrency test with 100 requests...');
    
    // 确保数据库存在并初始化表
    const db = new sqlite3.Database(DB_PATH);
    await new Promise((resolve) => {
        db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)`, () => {
            db.run(`CREATE TABLE IF NOT EXISTS votes (voter_id TEXT, target_user_id TEXT, vote_time TEXT)`, () => {
                resolve();
            });
        });
    });
    db.close();

    const concurrency = 100;
    const promises = [];
    const targetUserId = uuidv4();

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < concurrency; i++) {
        const voterId = uuidv4();
        promises.push(
            voteWithNewConnection(voterId, targetUserId)
                .then(() => {
                    successCount++;
                    process.stdout.write('.');
                })
                .catch((err) => {
                    failCount++;
                    // console.error(err.message);
                    process.stdout.write('x');
                })
        );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    
    console.log('\n\nTest Results:');
    console.log(`Total Requests: ${concurrency}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Time Taken: ${(endTime - startTime) / 1000}s`);
}

runTest().catch(console.error);
