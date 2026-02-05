/**
 * 创建投票设置表的数据库迁移
 * 用于存储投票开关状态和其他投票相关设置
 */

const fs = require('fs');
const path = require('path');

/**
 * 执行迁移 - 创建投票设置表
 * @param {Object} db - 数据库连接对象
 */
function up() {
    return new Promise(async (resolve, reject) => {
        const { getDatabase, releaseConnection } = require('../init');
        const db = await getDatabase();
        
        console.log('Running migration: 004-create-voting-settings-table');
        
        db.serialize(() => {
            // 创建投票设置表
            const createVotingSettingsTable = `
                CREATE TABLE IF NOT EXISTS voting_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    setting_key TEXT UNIQUE NOT NULL,
                    setting_value TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            db.run(createVotingSettingsTable, (err) => {
                if (err) {
                    releaseConnection(db);
                    return reject(err);
                }
                console.log('Created voting_settings table');
                
                // 插入默认设置
                const insertDefaultSettings = `
                    INSERT OR IGNORE INTO voting_settings (setting_key, setting_value, description) VALUES
                    ('voting_enabled', 'true', '投票功能是否开启'),
                    ('voting_start_time', '', '投票开始时间（可选）'),
                    ('voting_end_time', '', '投票结束时间（可选）'),
                    ('voting_message', '主持人尚未开启投票通道，请稍后再试', '投票关闭时显示的消息'),
                    ('max_votes_per_user', '2', '每个用户最多可投票数（男女各一票）'),
                    ('allow_self_vote', 'false', '是否允许为自己投票')
                `;
                
                db.exec(insertDefaultSettings);
                console.log('Inserted default voting settings');
                
                // 创建设置更新触发器
                const createUpdateTrigger = `
                    CREATE TRIGGER IF NOT EXISTS update_voting_settings_timestamp 
                    AFTER UPDATE ON voting_settings
                    BEGIN
                        UPDATE voting_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `;
                
                db.run(createUpdateTrigger, (err) => {
                    releaseConnection(db);
                    if (err) {
                        return reject(err);
                    }
                    console.log('Created update trigger for voting_settings');
                    resolve();
                });
            });
        });
    });
}

/**
 * 回滚迁移 - 删除投票设置表
 * @param {Object} db - 数据库连接对象
 */
function down() {
    return new Promise(async (resolve, reject) => {
        const { getDatabase } = require('../init');
        const db = await getDatabase();
        
        console.log('Rolling back migration: 004-create-voting-settings-table');
        
        db.serialize(() => {
            // 删除触发器
            db.run('DROP TRIGGER IF EXISTS update_voting_settings_timestamp', (err) => {
                if (err) {
                    releaseConnection(db);
                    return reject(err);
                }
                
                // 删除表
                db.run('DROP TABLE IF EXISTS voting_settings', (err) => {
                    releaseConnection(db);
                    if (err) {
                        return reject(err);
                    }
                    console.log('Dropped voting_settings table and triggers');
                    resolve();
                });
            });
        });
    });
}

module.exports = {
    up,
    down
};