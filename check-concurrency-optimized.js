
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data/voting.db');

function atomicVoteSim(db, voterId, targetUserId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (err) => {
        if (err) return reject(err);

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

// 模拟优化后的连接方式
function voteWithOptimizedConnection(voterId, targetUserId) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        
        // 关键优化：设置 busyTimeout
        db.configure('busyTimeout', 5000);
        
        // 确保开启 WAL (虽然通常只需设置一次，但多连接下确保每个连接都感知到)
        db.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) {
                db.close();
                return reject(err);
            }
             db.run('PRAGMA synchronous = NORMAL;', (err) => { // 进一步优化
                 if (err) {
                    db.close();
                    return reject(err);
                }

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
        });
    });
}

async function runTest() {
    console.log('Starting optimized concurrency test with 100 requests...');
    
    // 初始化并开启 WAL
    const dbInit = new sqlite3.Database(DB_PATH);
    await new Promise(r => {
        dbInit.run('PRAGMA journal_mode = WAL;', () => {
             dbInit.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT)`, () => {
                dbInit.run(`CREATE TABLE IF NOT EXISTS votes (voter_id TEXT, target_user_id TEXT, vote_time TEXT)`, () => {
                    dbInit.close();
                    r();
                });
            });
        });
    });

    const concurrency = 100;
    const promises = [];
    const targetUserId = uuidv4();

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < concurrency; i++) {
        const voterId = uuidv4();
        promises.push(
            voteWithOptimizedConnection(voterId, targetUserId)
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
    
    console.log('\n\nOptimized Test Results:');
    console.log(`Total Requests: ${concurrency}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Time Taken: ${(endTime - startTime) / 1000}s`);
}

runTest().catch(console.error);
