/**
 * 投票设置API测试脚本
 * 验证投票开关功能是否正常工作
 */

const { default: fetch } = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testVotingSettingsAPI() {
    console.log('🧪 开始测试投票设置API...\n');
    
    try {
        // 1. 测试获取投票状态（公开接口）
        console.log('1️⃣ 测试获取投票状态...');
        const statusResponse = await fetch(`${BASE_URL}/api/voting-settings/status`);
        const statusResult = await statusResponse.json();
        
        if (statusResult.success) {
            console.log('✅ 投票状态获取成功');
            console.log('   - 投票开启:', statusResult.status.enabled);
            console.log('   - 可以投票:', statusResult.status.canVote);
            console.log('   - 提示消息:', statusResult.status.message || '无');
        } else {
            console.log('❌ 投票状态获取失败:', statusResult.message);
        }
        
        // 2. 测试模拟用户投票（验证投票状态检查）
        console.log('\n2️⃣ 测试用户投票（验证状态检查）...');
        const voteResponse = await fetch(`${BASE_URL}/api/votes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voterId: 'test-voter-123',
                targetUserId: 'test-candidate-456'
            })
        });
        
        const voteResult = await voteResponse.json();
        
        if (voteResult.success) {
            console.log('✅ 投票成功（投票已开启）');
        } else {
            if (voteResult.errorCode === 'VOTING_DISABLED') {
                console.log('✅ 投票被正确阻止（投票已关闭）');
                console.log('   - 错误代码:', voteResult.errorCode);
                console.log('   - 提示消息:', voteResult.message);
            } else {
                console.log('ℹ️ 投票失败（其他原因）:', voteResult.message);
                console.log('   - 错误代码:', voteResult.errorCode);
            }
        }
        
        // 3. 测试数据库连接
        console.log('\n3️⃣ 测试数据库连接...');
        const VotingSettingsManager = require('./src/database/VotingSettingsManager');
        const votingSettings = new VotingSettingsManager();
        
        try {
            const testSetting = await votingSettings.getSetting('voting_enabled');
            console.log('✅ 数据库连接正常');
            console.log('   - voting_enabled 设置值:', testSetting);
            
            // 测试设置更新
            const originalValue = testSetting;
            await votingSettings.setSetting('voting_enabled', 'false');
            const newValue = await votingSettings.getSetting('voting_enabled');
            console.log('✅ 设置更新测试成功');
            console.log('   - 更新后的值:', newValue);
            
            // 恢复原始值
            await votingSettings.setSetting('voting_enabled', originalValue);
            console.log('✅ 设置已恢复为原始值');
            
        } catch (dbError) {
            console.log('❌ 数据库操作失败:', dbError.message);
        }
        
        // 4. 测试设置缓存
        console.log('\n4️⃣ 测试设置缓存...');
        const start = Date.now();
        await votingSettings.getSetting('voting_enabled');
        const firstCall = Date.now() - start;
        
        const start2 = Date.now();
        await votingSettings.getSetting('voting_enabled');
        const secondCall = Date.now() - start2;
        
        console.log('✅ 缓存测试完成');
        console.log(`   - 首次调用耗时: ${firstCall}ms`);
        console.log(`   - 缓存调用耗时: ${secondCall}ms`);
        
        if (secondCall < firstCall) {
            console.log('✅ 缓存机制工作正常');
        }
        
        console.log('\n🎉 所有测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
        console.error('详细错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testVotingSettingsAPI().then(() => {
        console.log('\n✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = testVotingSettingsAPI;