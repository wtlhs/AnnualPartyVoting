/**
 * 投票设置管理器
 * 负责管理投票相关的设置，包括投票开关、时间限制等
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class VotingSettingsManager {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '../../data/voting.db');
        this.db = null;
        this.settingsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
        this.lastCacheUpdate = 0;
    }

    /**
     * 初始化数据库连接
     */
    init() {
        if (!this.db) {
            this.db = new sqlite3.Database(this.dbPath);
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.run('PRAGMA foreign_keys = ON');
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * 获取投票设置
     * @param {string} key - 设置键名
     * @returns {Promise<string|null>} 设置值
     */
    getSetting(key) {
        return new Promise((resolve, reject) => {
            // 检查缓存
            if (this.isCacheValid() && this.settingsCache.has(key)) {
                return resolve(this.settingsCache.get(key));
            }
            
            const db = new sqlite3.Database(this.dbPath);
            
            try {
                const stmt = db.prepare('SELECT setting_value FROM voting_settings WHERE setting_key = ?');
                stmt.get(key, (err, result) => {
                    stmt.finalize();
                    db.close();
                    
                    if (err) {
                        console.error('Error getting voting setting:', err);
                        return reject(err);
                    }
                    
                    const value = result ? result.setting_value : null;
                    
                    // 更新缓存
                    this.settingsCache.set(key, value);
                    
                    resolve(value);
                });
            } catch (error) {
                db.close();
                console.error('Error getting voting setting:', error);
                reject(error);
            }
        });
    }

    /**
     * 设置投票配置
     * @param {string} key - 设置键名
     * @param {string} value - 设置值
     * @param {string} description - 设置描述（可选）
     * @returns {Promise<boolean>} 是否设置成功
     */
    setSetting(key, value, description = null) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            try {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO voting_settings (setting_key, setting_value, description, updated_at)
                    VALUES (?, ?, COALESCE(?, (SELECT description FROM voting_settings WHERE setting_key = ?)), CURRENT_TIMESTAMP)
                `);
                
                stmt.run(key, value, description, key, (err) => {
                    stmt.finalize();
                    db.close();
                    
                    if (err) {
                        console.error('Error setting voting setting:', err);
                        return reject(err);
                    }
                    
                    // 清除缓存
                    this.clearCache();
                    
                    console.log(`Voting setting updated: ${key} = ${value}`);
                    resolve(true);
                });
            } catch (error) {
                db.close();
                console.error('Error setting voting setting:', error);
                reject(error);
            }
        });
    }

    /**
     * 获取所有投票设置
     * @returns {Promise<Object>} 所有设置的键值对
     */
    getAllSettings() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            try {
                const stmt = db.prepare('SELECT setting_key, setting_value, description, updated_at FROM voting_settings');
                stmt.all((err, results) => {
                    stmt.finalize();
                    db.close();
                    
                    if (err) {
                        console.error('Error getting all voting settings:', err);
                        return reject(err);
                    }
                    
                    const settings = {};
                    results.forEach(row => {
                        settings[row.setting_key] = {
                            value: row.setting_value,
                            description: row.description,
                            updatedAt: row.updated_at
                        };
                    });
                    
                    resolve(settings);
                });
            } catch (error) {
                db.close();
                console.error('Error getting all voting settings:', error);
                reject(error);
            }
        });
    }

    /**
     * 批量更新设置
     * @param {Object} settings - 设置对象 {key: value, ...}
     * @returns {Promise<boolean>} 是否更新成功
     */
    async updateSettings(settings) {
        try {
            for (const [key, value] of Object.entries(settings)) {
                await this.setSetting(key, value);
            }
            console.log('Batch voting settings updated:', Object.keys(settings));
            return true;
        } catch (error) {
            console.error('Error updating voting settings:', error);
            return false;
        }
    }

    /**
     * 检查投票是否开启
     * @returns {Promise<boolean>} 投票是否开启
     */
    async isVotingEnabled() {
        const enabled = await this.getSetting('voting_enabled');
        return enabled === 'true';
    }

    /**
     * 开启投票
     * @returns {Promise<boolean>} 是否操作成功
     */
    async enableVoting() {
        return await this.setSetting('voting_enabled', 'true');
    }

    /**
     * 关闭投票
     * @returns {Promise<boolean>} 是否操作成功
     */
    async disableVoting() {
        return await this.setSetting('voting_enabled', 'false');
    }

    /**
     * 获取投票关闭时的提示消息
     * @returns {Promise<string>} 提示消息
     */
    async getVotingDisabledMessage() {
        const message = await this.getSetting('voting_message');
        return message || '主持人尚未开启投票通道，请稍后再试';
    }

    /**
     * 设置投票关闭时的提示消息
     * @param {string} message - 提示消息
     * @returns {Promise<boolean>} 是否设置成功
     */
    async setVotingDisabledMessage(message) {
        return await this.setSetting('voting_message', message);
    }

    /**
     * 检查投票时间限制
     * @returns {Promise<Object>} 时间检查结果
     */
    async checkVotingTime() {
        const startTime = await this.getSetting('voting_start_time');
        const endTime = await this.getSetting('voting_end_time');
        const now = new Date();
        
        const result = {
            isWithinTimeRange: true,
            message: null,
            startTime: startTime,
            endTime: endTime
        };
        
        // 检查开始时间
        if (startTime && startTime.trim()) {
            const start = new Date(startTime);
            if (now < start) {
                result.isWithinTimeRange = false;
                result.message = `投票将于 ${start.toLocaleString('zh-CN')} 开始`;
                return result;
            }
        }
        
        // 检查结束时间
        if (endTime && endTime.trim()) {
            const end = new Date(endTime);
            if (now > end) {
                result.isWithinTimeRange = false;
                result.message = `投票已于 ${end.toLocaleString('zh-CN')} 结束`;
                return result;
            }
        }
        
        return result;
    }

    /**
     * 获取投票状态信息
     * @returns {Promise<Object>} 投票状态信息
     */
    async getVotingStatus() {
        const enabled = await this.isVotingEnabled();
        const timeCheck = await this.checkVotingTime();
        
        return {
            enabled: enabled,
            withinTimeRange: timeCheck.isWithinTimeRange,
            canVote: enabled && timeCheck.isWithinTimeRange,
            message: enabled ? timeCheck.message : await this.getVotingDisabledMessage(),
            settings: {
                votingEnabled: enabled,
                startTime: timeCheck.startTime,
                endTime: timeCheck.endTime,
                disabledMessage: await this.getVotingDisabledMessage()
            }
        };
    }

    /**
     * 获取每用户最大投票数
     * @returns {Promise<number>} 最大投票数
     */
    async getMaxVotesPerUser() {
        const maxVotes = await this.getSetting('max_votes_per_user');
        return parseInt(maxVotes) || 2;
    }

    /**
     * 检查是否允许自投票
     * @returns {Promise<boolean>} 是否允许自投票
     */
    async isAllowSelfVote() {
        const allowed = await this.getSetting('allow_self_vote');
        return allowed === 'true';
    }

    /**
     * 检查缓存是否有效
     * @returns {boolean} 缓存是否有效
     */
    isCacheValid() {
        return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
    }

    /**
     * 清除设置缓存
     */
    clearCache() {
        this.settingsCache.clear();
        this.lastCacheUpdate = 0;
    }

    /**
     * 刷新缓存
     */
    async refreshCache() {
        this.clearCache();
        // 预加载常用设置
        const commonSettings = [
            'voting_enabled',
            'voting_message',
            'voting_start_time',
            'voting_end_time',
            'max_votes_per_user',
            'allow_self_vote'
        ];
        
        for (const key of commonSettings) {
            await this.getSetting(key);
        }
        
        this.lastCacheUpdate = Date.now();
    }

    /**
     * 重置所有设置为默认值
     * @returns {Promise<boolean>} 是否重置成功
     */
    async resetToDefaults() {
        const defaultSettings = {
            'voting_enabled': 'true',
            'voting_start_time': '',
            'voting_end_time': '',
            'voting_message': '主持人尚未开启投票通道，请稍后再试',
            'max_votes_per_user': '2',
            'allow_self_vote': 'false'
        };
        
        return await this.updateSettings(defaultSettings);
    }

    /**
     * 获取设置统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getSettingsStats() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            try {
                const stmt = db.prepare('SELECT COUNT(*) as total FROM voting_settings');
                stmt.get(async (err, result) => {
                    stmt.finalize();
                    db.close();
                    
                    if (err) {
                        console.error('Error getting settings stats:', err);
                        return reject(err);
                    }
                    
                    try {
                        const votingEnabled = await this.isVotingEnabled();
                        
                        resolve({
                            totalSettings: result.total,
                            votingEnabled: votingEnabled,
                            lastUpdate: this.lastCacheUpdate,
                            cacheSize: this.settingsCache.size
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                db.close();
                console.error('Error getting settings stats:', error);
                reject(error);
            }
        });
    }
}

module.exports = VotingSettingsManager;