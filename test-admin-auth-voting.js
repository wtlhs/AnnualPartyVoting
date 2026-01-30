/**
 * 管理员认证投票控制测试
 * 测试完整的管理员认证流程和投票控制
 */

const { default: fetch } = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = 'admin123'; // 默认管理员密码

async function testAdminAuthAndVoting() {
    console.log('🔐 开始测试管理员认证和投票控制...\n');
    
    try {
        // 1. 管理员登录
        console.log('1️⃣ 测试管理员登录...');
        const loginResponse = await fetch(`${BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: ADMIN_PASSWORD
            })
        });
        
        const loginResult = await loginResponse.json();
        
        if (loginResult.success) {
            console.log('✅ 管理员登录成功');
            const adminToken = loginResult.token;
            
            // 2. 使用管理员权限获取投票设置
            console.log('\n2️⃣ 获取投票设置...');
            const settingsResponse = await fetch(`${BASE_URL}/api/voting-settings`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            
            const settingsResult = await settingsResponse.json();
            
            if (settingsResult.success) {
                console.log('✅ 投票设置获取成功');
                console.log('   - 设置数量:', Object.keys(settingsResult.settings).length);
                console.log('   - 当前投票状态:', settingsResult.settings.voting_enabled?.value);
                
                // 3. 测试投票开关
                console.log('\n3️⃣ 测试投票开关...');
                
                // 切换投票状态
                const toggleResponse = await fetch(`${BASE_URL}/api/voting-settings/toggle`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: '管理员正在测试投票开关功能'
                    })
                });
                
                const toggleResult = await toggleResponse.json();
                
                if (toggleResult.success) {
                    console.log('✅ 投票状态切换成功');
                    console.log('   - 操作消息:', toggleResult.message);
                    console.log('   - 新状态:', toggleResult.newState);
                    
                    // 4. 验证状态变更
                    console.log('\n4️⃣ 验证状态变更...');
                    const verifyResponse = await fetch(`${BASE_URL}/api/voting-settings/status`);
                    const verifyResult = await verifyResponse.json();
                    
                    if (verifyResult.success) {
                        console.log('✅ 状态验证成功');
                        console.log('   - 投票开启:', verifyResult.status.enabled);
                        console.log('   - 可以投票:', verifyResult.status.canVote);
                        console.log('   - 提示消息:', verifyResult.status.message);
                    }
                    
                    // 5. 测试用户投票体验
                    console.log('\n5️⃣ 测试用户投票体验...');
                    const voteResponse = await fetch(`${BASE_URL}/api/votes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            voterId: 'test-voter-' + Date.now(),
                            targetUserId: 'test-candidate-' + Date.now()
                        })
                    });
                    
                    const voteResult = await voteResponse.json();
                    
                    if (voteResult.success) {
                        console.log('✅ 用户可以正常投票（投票已开启）');
                    } else {
                        if (voteResult.errorCode === 'VOTING_DISABLED') {
                            console.log('✅ 投票被正确阻止（投票已关闭）');
                            console.log('   - 用户看到的消息:', voteResult.message);
                        } else {
                            console.log('ℹ️ 投票失败（其他原因）:', voteResult.message);
                        }
                    }
                    
                    // 6. 测试自定义消息设置
                    console.log('\n6️⃣ 测试自定义消息设置...');
                    const customMessage = '投票活动暂时关闭，请等待主持人通知 - ' + new Date().toLocaleTimeString();
                    
                    const disableResponse = await fetch(`${BASE_URL}/api/voting-settings/disable`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${adminToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: customMessage
                        })
                    });
                    
                    const disableResult = await disableResponse.json();
                    
                    if (disableResult.success) {
                        console.log('✅ 投票关闭并设置自定义消息成功');
                        
                        // 验证自定义消息
                        const messageVerifyResponse = await fetch(`${BASE_URL}/api/voting-settings/status`);
                        const messageVerifyResult = await messageVerifyResponse.json();
                        
                        if (messageVerifyResult.success) {
                            console.log('✅ 自定义消息验证成功');
                            console.log('   - 显示的消息:', messageVerifyResult.status.message);
                        }
                    }
                    
                } else {
                    console.log('❌ 投票状态切换失败:', toggleResult.message);
                }
                
            } else {
                console.log('❌ 投票设置获取失败:', settingsResult.message);
            }
            
        } else {
            console.log('❌ 管理员登录失败:', loginResult.message);
            console.log('ℹ️ 请确认管理员密码是否正确，默认密码是: admin123');
        }
        
        console.log('\n🎉 管理员认证和投票控制测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
        console.error('详细错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testAdminAuthAndVoting().then(() => {
        console.log('\n✅ 测试脚本执行完成');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ 测试脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = testAdminAuthAndVoting;