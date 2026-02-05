/**
 * 投票设置管理路由
 * 提供投票开关和相关设置的API接口
 */

const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const VotingSettingsManager = require('../database/VotingSettingsManager');
const auditLog = require('../database/AuditLogManager');

const router = express.Router();
const votingSettings = new VotingSettingsManager();

/**
 * 获取投票状态（公开接口）
 * GET /api/voting-settings/status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await votingSettings.getVotingStatus();
        
        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Get voting status error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'GET_STATUS_FAILED',
            message: '获取投票状态失败'
        });
    }
});

/**
 * 获取所有投票设置（管理员接口）
 * GET /api/voting-settings
 */
router.get('/', requireAdmin, async (req, res) => {
    try {
        const settings = await votingSettings.getAllSettings();
        const stats = await votingSettings.getSettingsStats();
        
        res.json({
            success: true,
            settings: settings,
            stats: stats
        });
    } catch (error) {
        console.error('Get voting settings error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'GET_SETTINGS_FAILED',
            message: '获取投票设置失败'
        });
    }
});

/**
 * 更新投票设置（管理员接口）
 * PUT /api/voting-settings
 */
router.put('/', requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                errorCode: 'INVALID_SETTINGS',
                message: '无效的设置数据'
            });
        }
        
        // 验证设置值
        const validationResult = validateSettings(settings);
        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                errorCode: 'VALIDATION_FAILED',
                message: validationResult.message,
                errors: validationResult.errors
            });
        }
        
        // 更新设置
        const success = await votingSettings.updateSettings(settings);
        
        if (success) {
            // 记录审计日志（非阻塞，失败不影响操作）
            auditLog.log({
                voteId: null,  // 系统操作，没有关联的投票
                action: 'UPDATE_VOTING_SETTINGS',
                adminId: null,  // 系统操作，admin_id 设为 null
                details: {
                    updatedSettings: Object.keys(settings),
                    newValues: settings
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(err => {
                console.warn('Audit log warning (non-blocking):', err.message);
            });

            // 获取更新后的状态
            const newStatus = await votingSettings.getVotingStatus();
            
            res.json({
                success: true,
                message: '投票设置更新成功',
                status: newStatus
            });
        } else {
            res.status(500).json({
                success: false,
                errorCode: 'UPDATE_FAILED',
                message: '更新投票设置失败'
            });
        }
    } catch (error) {
        console.error('Update voting settings error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'UPDATE_SETTINGS_FAILED',
            message: '更新投票设置失败'
        });
    }
});

/**
 * 开启投票（管理员接口）
 * POST /api/voting-settings/enable
 */
router.post('/enable', requireAdmin, async (req, res) => {
    try {
        const success = await votingSettings.enableVoting();
        
        if (success) {
            // 记录审计日志（非阻塞，失败不影响操作）
            auditLog.log({
                voteId: null,  // 系统操作，没有关联的投票
                action: 'ENABLE_VOTING',
                adminId: null,  // 系统操作，admin_id 设为 null
                details: {
                    action: 'enable_voting',
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(err => {
                console.warn('Audit log warning (non-blocking):', err.message);
            });

            const status = await votingSettings.getVotingStatus();
            
            res.json({
                success: true,
                message: '投票已开启',
                status: status
            });
        } else {
            res.status(500).json({
                success: false,
                errorCode: 'ENABLE_FAILED',
                message: '开启投票失败'
            });
        }
    } catch (error) {
        console.error('Enable voting error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'ENABLE_VOTING_FAILED',
            message: '开启投票失败'
        });
    }
});

/**
 * 关闭投票（管理员接口）
 * POST /api/voting-settings/disable
 */
router.post('/disable', requireAdmin, async (req, res) => {
    try {
        const { message } = req.body;
        
        // 如果提供了自定义消息，先更新消息
        if (message && typeof message === 'string' && message.trim()) {
            await votingSettings.setVotingDisabledMessage(message.trim());
        }
        
        const success = await votingSettings.disableVoting();
        
        if (success) {
            // 记录审计日志（非阻塞，失败不影响操作）
            auditLog.log({
                voteId: null,  // 系统操作，没有关联的投票
                action: 'DISABLE_VOTING',
                adminId: null,  // 系统操作，admin_id 设为 null
                details: {
                    action: 'disable_voting',
                    customMessage: message || null,
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(err => {
                console.warn('Audit log warning (non-blocking):', err.message);
            });

            const status = await votingSettings.getVotingStatus();
            
            res.json({
                success: true,
                message: '投票已关闭',
                status: status
            });
        } else {
            res.status(500).json({
                success: false,
                errorCode: 'DISABLE_FAILED',
                message: '关闭投票失败'
            });
        }
    } catch (error) {
        console.error('Disable voting error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'DISABLE_VOTING_FAILED',
            message: '关闭投票失败'
        });
    }
});

/**
 * 切换投票状态（管理员接口）
 * POST /api/voting-settings/toggle
 */
router.post('/toggle', requireAdmin, async (req, res) => {
    try {
        const currentStatus = await votingSettings.isVotingEnabled();
        const { message } = req.body;
        
        let success;
        let action;
        
        if (currentStatus) {
            // 当前开启，切换为关闭
            if (message && typeof message === 'string' && message.trim()) {
                await votingSettings.setVotingDisabledMessage(message.trim());
            }
            success = await votingSettings.disableVoting();
            action = 'DISABLE_VOTING';
        } else {
            // 当前关闭，切换为开启
            success = await votingSettings.enableVoting();
            action = 'ENABLE_VOTING';
        }
        
        if (success) {
            // 记录审计日志（非阻塞，失败不影响操作）
            auditLog.log({
                voteId: null,  // 系统操作，没有关联的投票
                action: action,
                adminId: null,  // 系统操作，admin_id 设为 null
                details: {
                    action: 'toggle_voting',
                    previousState: currentStatus,
                    newState: !currentStatus,
                    customMessage: message || null,
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(err => {
                console.warn('Audit log warning (non-blocking):', err.message);
            });

            const newStatus = await votingSettings.getVotingStatus();
            
            res.json({
                success: true,
                message: `投票已${currentStatus ? '关闭' : '开启'}`,
                status: newStatus,
                previousState: currentStatus,
                newState: !currentStatus
            });
        } else {
            res.status(500).json({
                success: false,
                errorCode: 'TOGGLE_FAILED',
                message: '切换投票状态失败'
            });
        }
    } catch (error) {
        console.error('Toggle voting error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'TOGGLE_VOTING_FAILED',
            message: '切换投票状态失败'
        });
    }
});

/**
 * 重置投票设置为默认值（管理员接口）
 * POST /api/voting-settings/reset
 */
router.post('/reset', requireAdmin, async (req, res) => {
    try {
        const success = await votingSettings.resetToDefaults();
        
        if (success) {
            // 记录审计日志（非阻塞，失败不影响操作）
            auditLog.log({
                voteId: null,  // 系统操作，没有关联的投票
                action: 'RESET_VOTING_SETTINGS',
                adminId: null,  // 系统操作，admin_id 设为 null
                details: {
                    action: 'reset_to_defaults',
                    timestamp: new Date().toISOString()
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(err => {
                console.warn('Audit log warning (non-blocking):', err.message);
            });

            const status = await votingSettings.getVotingStatus();
            
            res.json({
                success: true,
                message: '投票设置已重置为默认值',
                status: status
            });
        } else {
            res.status(500).json({
                success: false,
                errorCode: 'RESET_FAILED',
                message: '重置投票设置失败'
            });
        }
    } catch (error) {
        console.error('Reset voting settings error:', error);
        res.status(500).json({
            success: false,
            errorCode: 'RESET_SETTINGS_FAILED',
            message: '重置投票设置失败'
        });
    }
});

/**
 * 验证投票设置
 * @param {Object} settings - 设置对象
 * @returns {Object} 验证结果
 */
function validateSettings(settings) {
    const errors = [];
    
    // 验证投票开关
    if (settings.hasOwnProperty('voting_enabled')) {
        if (!['true', 'false'].includes(settings.voting_enabled)) {
            errors.push('voting_enabled 必须是 "true" 或 "false"');
        }
    }
    
    // 验证时间格式
    if (settings.hasOwnProperty('voting_start_time') && settings.voting_start_time.trim()) {
        const startTime = new Date(settings.voting_start_time);
        if (isNaN(startTime.getTime())) {
            errors.push('voting_start_time 时间格式无效');
        }
    }
    
    if (settings.hasOwnProperty('voting_end_time') && settings.voting_end_time.trim()) {
        const endTime = new Date(settings.voting_end_time);
        if (isNaN(endTime.getTime())) {
            errors.push('voting_end_time 时间格式无效');
        }
        
        // 检查结束时间是否晚于开始时间
        if (settings.hasOwnProperty('voting_start_time') && settings.voting_start_time.trim()) {
            const startTime = new Date(settings.voting_start_time);
            if (!isNaN(startTime.getTime()) && endTime <= startTime) {
                errors.push('投票结束时间必须晚于开始时间');
            }
        }
    }
    
    // 验证消息长度
    if (settings.hasOwnProperty('voting_message')) {
        if (typeof settings.voting_message !== 'string') {
            errors.push('voting_message 必须是字符串');
        } else if (settings.voting_message.length > 200) {
            errors.push('voting_message 长度不能超过200个字符');
        }
    }
    
    // 验证最大投票数
    if (settings.hasOwnProperty('max_votes_per_user')) {
        const maxVotes = parseInt(settings.max_votes_per_user);
        if (isNaN(maxVotes) || maxVotes < 1 || maxVotes > 10) {
            errors.push('max_votes_per_user 必须是1-10之间的整数');
        }
    }
    
    // 验证自投票设置
    if (settings.hasOwnProperty('allow_self_vote')) {
        if (!['true', 'false'].includes(settings.allow_self_vote)) {
            errors.push('allow_self_vote 必须是 "true" 或 "false"');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        message: errors.length > 0 ? errors.join('; ') : null
    };
}

module.exports = router;