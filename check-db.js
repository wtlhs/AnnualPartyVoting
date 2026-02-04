const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'voting.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 检查数据库...\n');

// 检查表是否存在
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ 查询表失败:', err);
    process.exit(1);
  }

  console.log('📋 数据库表列表:');
  tables.forEach(t => console.log(`  - ${t.name}`));
  console.log();

  // 检查 votes 表结构
  db.all("PRAGMA table_info(votes)", (err, columns) => {
    if (err) {
      console.error('❌ 获取 votes 表结构失败:', err);
      process.exit(1);
    }

    console.log('📊 votes 表结构:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
    });
    console.log();

    // 统计记录数
    db.get("SELECT COUNT(*) as total FROM votes", (err, result) => {
      if (err) {
        console.error('❌ 统计记录数失败:', err);
        process.exit(1);
      }

      console.log(`📈 votes 表总记录数: ${result.total}`);
      console.log();

      // 查看几条示例数据
      db.all("SELECT * FROM votes LIMIT 5", (err, rows) => {
        if (err) {
          console.error('❌ 查询示例数据失败:', err);
          process.exit(1);
        }

        if (rows.length === 0) {
          console.log('⚠️  votes 表为空，没有任何数据！');
        } else {
          console.log('📝 示例数据 (前5条):');
          rows.forEach(row => {
            console.log(`  ID: ${row.id}, Voter: ${row.voter_id}, Target: ${row.target_user_id}, Status: ${row.status || 'NULL'}`);
          });
        }

        console.log('\n✅ 检查完成！');
        db.close();
      });
    });
  });
});
