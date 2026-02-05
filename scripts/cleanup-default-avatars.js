/**
 * 清理数据库中的默认头像路径
 * 将所有保存了默认头像路径的用户的 avatar_url 设置为 NULL
 * 这样前端会使用 CSS 默认头像，而不是请求 SVG 文件
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'voting.db');
const DEFAULT_AVATARS = [
  '/static/images/default-male-avatar.svg',
  '/static/images/default-female-avatar.svg'
];

/**
 * 清理默认头像路径
 */
async function cleanupDefaultAvatars() {
  return new Promise((resolve, reject) => {
    console.log('🔧 开始清理默认头像路径...\n');

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err);
        return reject(err);
      }

      console.log(`✓ 数据库已连接: ${DB_PATH}\n`);

      // 先查询有多少用户使用了默认头像
      const countSql = `
        SELECT COUNT(*) as count,
               SUM(CASE WHEN avatar_url = '/static/images/default-male-avatar.svg' THEN 1 ELSE 0 END) as male_count,
               SUM(CASE WHEN avatar_url = '/static/images/default-female-avatar.svg' THEN 1 ELSE 0 END) as female_count
        FROM users
        WHERE avatar_url IN ('/static/images/default-male-avatar.svg', '/static/images/default-female-avatar.svg')
      `;

      db.get(countSql, [], (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }

        const totalUsers = row.count;
        const maleUsers = row.male_count;
        const femaleUsers = row.female_count;

        console.log('📊 统计信息:');
        console.log(`   总计: ${totalUsers} 个用户使用了默认头像路径`);
        console.log(`   男性: ${maleUsers} 个`);
        console.log(`   女性: ${femaleUsers} 个`);
        console.log('');

        if (totalUsers === 0) {
          console.log('✨ 数据库中没有需要清理的用户！');
          db.close();
          return resolve({ cleaned: 0, male: 0, female: 0 });
        }

        // 执行清理操作
        const updateSql = `
          UPDATE users
          SET avatar_url = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE avatar_url IN ('/static/images/default-male-avatar.svg', '/static/images/default-female-avatar.svg')
        `;

        db.run(updateSql, [], function(updateErr) {
          if (updateErr) {
            db.close();
            return reject(updateErr);
          }

          console.log(`✅ 清理完成！`);
          console.log(`   更新了 ${this.changes} 条记录\n`);

          // 验证清理结果
          const verifySql = `
            SELECT COUNT(*) as remaining_count
            FROM users
            WHERE avatar_url IN ('/static/images/default-male-avatar.svg', '/static/images/default-female-avatar.svg')
          `;

          db.get(verifySql, [], (verifyErr, verifyRow) => {
            db.close();

            if (verifyErr) {
              console.warn('⚠️  无法验证清理结果');
            } else {
              if (verifyRow.remaining_count === 0) {
                console.log('✅ 验证通过：所有默认头像路径已清除！');
              } else {
                console.warn(`⚠️  仍有 ${verifyRow.remaining_count} 条记录未清理`);
              }
            }

            resolve({
              cleaned: this.changes,
              male: maleUsers,
              female: femaleUsers
            });
          });
        });
      });
    });
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('   清理默认头像路径工具');
  console.log('========================================\n');

  try {
    const result = await cleanupDefaultAvatars();

    console.log('\n📋 清理结果汇总:');
    console.log('========================================');
    console.log(`✓ 清理用户数: ${result.cleaned}`);
    console.log(`  - 男性: ${result.male}`);
    console.log(`  - 女性: ${result.female}`);
    console.log('\n✨ 优化效果:');
    console.log('   - 减少约 ' + (result.cleaned * 2) + ' 次 SVG 请求');
    console.log('   - 节省约 ' + (result.cleaned * 2.5) + 'KB 带宽');
    console.log('   - 前端使用 CSS 默认头像，零请求');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    process.exit(1);
  }
}

// 运行清理
main();
