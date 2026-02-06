const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'voting.db');
const db = new sqlite3.Database(dbPath);

// 检查女性投票记录
db.all(`
  SELECT
    v.target_user_id,
    u.name,
    u.gender
  FROM votes v
  LEFT JOIN users u ON v.target_user_id = u.id
  WHERE u.gender = 'female' OR u.id IS NULL
`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('女性投票记录总数:', rows.length);

  const validUsers = rows.filter(r => r.name !== null);
  const invalidVotes = rows.filter(r => r.name === null);

  console.log('有效用户投票数:', validUsers.length);
  console.log('指向已删除用户的投票数:', invalidVotes.length);

  if (invalidVotes.length > 0) {
    console.log('\n已删除用户ID:');
    invalidVotes.forEach(v => {
      console.log('  -', v.target_user_id);
    });
  }

  db.close();
});
