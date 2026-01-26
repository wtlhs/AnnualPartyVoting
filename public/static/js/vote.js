// 投票确认页面 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const userId = getUserIdFromUrl();
    if (userId) {
        // 添加调试信息
        addDebugInfo(userId);
        
        loadCandidateInfo(userId);
        setupVoteButtons(userId);
        checkVoteEligibility(userId);
    } else {
        showError('无效的用户ID');
    }
});

function addDebugInfo(targetUserId) {
    // 在开发环境中显示调试信息
    const currentUserId = localStorage.getItem('annual_party_user_id');
    const currentUserName = localStorage.getItem('annual_party_user_name');
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const debugDiv = document.createElement('div');
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            max-width: 200px;
        `;
        
        const isSelfVote = currentUserId === targetUserId;
        debugDiv.innerHTML = `
            <strong>调试信息</strong><br>
            当前用户: ${currentUserName || '未登录'}<br>
            当前用户ID: ${currentUserId || '无'}<br>
            目标用户ID: ${targetUserId}<br>
            <span style="color: ${isSelfVote ? '#ff6b6b' : '#51cf66'}">
                ${isSelfVote ? '⚠️ 自投票' : '✅ 正常投票'}
            </span>
        `;
        
        document.body.appendChild(debugDiv);
        
        // 5秒后自动隐藏
        setTimeout(() => {
            if (debugDiv.parentNode) {
                debugDiv.style.opacity = '0.3';
            }
        }, 5000);
        
        // 点击隐藏
        debugDiv.addEventListener('click', () => {
            debugDiv.remove();
        });
    }
}

function getUserIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadCandidateInfo(userId) {
    try {
        showLoading('正在加载候选人信息...');
        
        const response = await fetch(`/api/users/${userId}`);
        const result = await response.json();
        
        if (result.success) {
            displayCandidateInfo(result);
            hideLoading();
        } else {
            hideLoading();
            showError(result.message || '加载候选人信息失败');
        }
    } catch (error) {
        console.error('Load candidate error:', error);
        hideLoading();
        showError('网络错误，请刷新页面重试');
    }
}

function displayCandidateInfo(userData) {
    document.getElementById('candidateName').textContent = userData.name;
    document.getElementById('candidateGender').textContent = `性别: ${userData.gender === 'male' ? '男士' : '女士'}`;
    document.getElementById('candidateVotes').textContent = `当前票数: ${userData.voteCount || 0}`;
    
    const avatarImg = document.getElementById('candidateAvatar');
    avatarImg.src = userData.avatarUrl || getDefaultAvatar(userData.gender);
    avatarImg.alt = `${userData.name}的头像`;
}

function getDefaultAvatar(gender) {
    return gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg';
}

async function checkVoteEligibility(targetUserId) {
    // 获取当前用户ID（如果已注册）
    let voterId = localStorage.getItem('annual_party_user_id');
    
    // 如果没有注册用户ID，生成临时投票者ID
    if (!voterId) {
        voterId = localStorage.getItem('voterId');
        if (!voterId) {
            voterId = generateVoterId();
            localStorage.setItem('voterId', voterId);
        }
    }
    
    // 前端自投票检查
    if (voterId === targetUserId) {
        showVoteRestriction('不能为自己投票', null);
        return;
    }
    
    try {
        const response = await fetch('/api/votes/check-eligibility', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voterId: voterId,
                targetUserId: targetUserId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (!result.canVote) {
                showVoteRestriction(result.reason, result.voterStatus);
            } else {
                showVoteEligible(result.voterStatus);
            }
        } else {
            console.error('Eligibility check failed:', result.message);
        }
        
    } catch (error) {
        console.error('Eligibility check error:', error);
        // 如果检查失败，仍然允许尝试投票，让服务器端处理
    }
}

function showVoteEligible(voterStatus) {
    const voteAction = document.querySelector('.vote-action');
    const questionElement = voteAction.querySelector('.vote-question');
    
    let statusText = '确认要为此参与者投票吗？';
    
    if (voterStatus.maleVoted && voterStatus.femaleVoted) {
        statusText += '\n\n注意：您已完成所有投票。';
    } else if (voterStatus.maleVoted || voterStatus.femaleVoted) {
        const remainingGender = voterStatus.maleVoted ? '女士' : '男士';
        statusText += `\n\n您还可以为一名${remainingGender}参与者投票。`;
    } else {
        statusText += '\n\n您可以为一名男士和一名女士参与者各投一票。';
    }
    
    questionElement.textContent = statusText;
}

function showVoteRestriction(reason, voterStatus) {
    const voteAction = document.querySelector('.vote-action');
    const questionElement = voteAction.querySelector('.vote-question');
    const buttonsDiv = voteAction.querySelector('.vote-buttons');
    
    questionElement.textContent = reason;
    questionElement.className = 'vote-question restriction';
    
    // 根据不同的限制类型显示不同的按钮
    if (reason.includes('不能为自己投票')) {
        // 自投票情况
        buttonsDiv.innerHTML = `
            <button id="scan-others-btn" class="btn-primary">为其他人投票</button>
            <button id="view-results-btn" class="btn-secondary">查看统计</button>
        `;
        
        document.getElementById('scan-others-btn').addEventListener('click', () => {
            window.location.href = '/scan';
        });
        document.getElementById('view-results-btn').addEventListener('click', viewStats);
        
        // 显示自投票提示
        const selfVoteInfo = document.createElement('div');
        selfVoteInfo.className = 'voted-info';
        selfVoteInfo.innerHTML = `
            <h4>💡 投票提示</h4>
            <p>系统不允许为自己投票，这是为了确保投票的公平性。</p>
            <p>您可以：</p>
            <ul>
                <li>扫描其他参与者的二维码进行投票</li>
                <li>通过用户列表为其他人投票</li>
                <li>查看当前的投票统计结果</li>
            </ul>
        `;
        voteAction.appendChild(selfVoteInfo);
        
    } else {
        // 其他投票限制情况（重复投票等）
        buttonsDiv.innerHTML = `
            <button id="view-results-btn" class="btn-secondary">查看统计</button>
            <button id="continue-scan-btn" class="btn-primary">继续扫码</button>
        `;
        
        document.getElementById('view-results-btn').addEventListener('click', viewStats);
        document.getElementById('continue-scan-btn').addEventListener('click', continueScan);
        
        // 显示已投票信息
        if (voterStatus && voterStatus.votedUsers && voterStatus.votedUsers.length > 0) {
            const votedInfo = document.createElement('div');
            votedInfo.className = 'voted-info';
            votedInfo.innerHTML = `
                <h4>您已投票的参与者：</h4>
                <ul>
                    ${voterStatus.votedUsers.map(user => 
                        `<li>${user.name} (${user.gender === 'male' ? '男士' : '女士'})</li>`
                    ).join('')}
                </ul>
            `;
            voteAction.appendChild(votedInfo);
        }
    }
}

function setupVoteButtons(targetUserId) {
    const confirmBtn = document.getElementById('confirmVoteBtn');
    const cancelBtn = document.getElementById('cancelVoteBtn');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            submitVote(targetUserId);
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
}

async function submitVote(targetUserId) {
    // 获取当前用户ID（如果已注册）
    let voterId = localStorage.getItem('annual_party_user_id');
    
    // 如果没有注册用户ID，生成临时投票者ID
    if (!voterId) {
        voterId = localStorage.getItem('voterId');
        if (!voterId) {
            voterId = generateVoterId();
            localStorage.setItem('voterId', voterId);
        }
    }
    
    // 前端自投票检查
    if (voterId === targetUserId) {
        showVoteResult({
            success: false,
            errorCode: 'SELF_VOTE_NOT_ALLOWED',
            message: '不能为自己投票',
            details: {
                reason: '系统不允许为自己投票',
                allowedActions: ['为其他参与者投票', '查看投票结果']
            }
        });
        return;
    }
    
    // 禁用投票按钮防止重复提交
    const confirmBtn = document.getElementById('confirmVoteBtn');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '投票中...';
    
    try {
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voterId: voterId,
                targetUserId: targetUserId
            })
        });
        
        const result = await response.json();
        
        showVoteResult(result);
        
    } catch (error) {
        console.error('Vote submission error:', error);
        showVoteResult({
            success: false,
            message: '网络错误，请重试'
        });
    } finally {
        // 恢复按钮状态
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

function generateVoterId() {
    return 'voter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showVoteResult(result) {
    const resultDiv = document.getElementById('voteResult');
    const titleElement = document.getElementById('resultTitle');
    const messageElement = document.getElementById('resultMessage');
    
    if (result.success) {
        titleElement.textContent = '投票成功！';
        let message = result.message || '您的投票已成功提交';
        
        if (result.vote && result.vote.targetUser) {
            message += `\n\n${result.vote.targetUser.name} 现在有 ${result.vote.targetUser.voteCount} 票`;
        }
        
        messageElement.textContent = message;
        resultDiv.className = 'vote-result success';
        
        // 添加后续操作按钮
        addPostVoteActions(resultDiv);
        
    } else {
        titleElement.textContent = '投票失败';
        let message = result.message || '投票提交失败，请重试';
        
        // 处理不同类型的错误
        if (result.errorCode === 'SELF_VOTE_NOT_ALLOWED') {
            titleElement.textContent = '不能为自己投票';
            message = '系统不允许为自己投票，这是为了确保投票的公平性。';
            if (result.details && result.details.allowedActions) {
                message += `\n\n您可以：${result.details.allowedActions.join('、')}`;
            }
            resultDiv.className = 'vote-result error';
            addSelfVoteActions(resultDiv);
            
        } else if (result.errorCode === 'DUPLICATE_VOTE' && result.details) {
            message += `\n\n您已投票给：${result.details.votedUser}`;
            if (result.details.allowedActions) {
                message += `\n\n您可以：${result.details.allowedActions.join('、')}`;
            }
            resultDiv.className = 'vote-result error';
            addDuplicateVoteActions(resultDiv);
            
        } else {
            resultDiv.className = 'vote-result error';
        }
        
        messageElement.textContent = message;
    }
    
    resultDiv.style.display = 'block';
    
    // 隐藏投票按钮
    const voteAction = document.querySelector('.vote-action');
    if (voteAction) {
        voteAction.style.display = 'none';
    }
}

function addPostVoteActions(resultDiv) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'post-vote-actions';
    actionsDiv.innerHTML = `
        <button id="continue-scan-post-vote" class="btn-primary">继续扫码投票</button>
        <button id="view-results-post-vote" class="btn-secondary">查看统计</button>
        <button id="go-home-post-vote" class="btn-secondary">返回首页</button>
    `;
    resultDiv.appendChild(actionsDiv);
    
    // 添加事件监听器
    document.getElementById('continue-scan-post-vote').addEventListener('click', continueScan);
    document.getElementById('view-results-post-vote').addEventListener('click', viewStats);
    document.getElementById('go-home-post-vote').addEventListener('click', goHome);
}

function addDuplicateVoteActions(resultDiv) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'duplicate-vote-actions';
    actionsDiv.innerHTML = `
        <button id="continue-scan-duplicate" class="btn-primary">扫码为其他性别投票</button>
        <button id="view-results-duplicate" class="btn-secondary">查看统计</button>
        <button id="go-home-duplicate" class="btn-secondary">返回首页</button>
    `;
    resultDiv.appendChild(actionsDiv);
    
    // 添加事件监听器
    document.getElementById('continue-scan-duplicate').addEventListener('click', continueScan);
    document.getElementById('view-results-duplicate').addEventListener('click', viewStats);
    document.getElementById('go-home-duplicate').addEventListener('click', goHome);
}

function addSelfVoteActions(resultDiv) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'self-vote-actions';
    actionsDiv.innerHTML = `
        <button id="scan-others-self" class="btn-primary">扫码为其他人投票</button>
        <button id="user-list-self" class="btn-primary">按姓名投票</button>
        <button id="view-results-self" class="btn-secondary">查看统计</button>
        <button id="go-home-self" class="btn-secondary">返回首页</button>
    `;
    resultDiv.appendChild(actionsDiv);
    
    // 添加事件监听器
    document.getElementById('scan-others-self').addEventListener('click', continueScan);
    document.getElementById('user-list-self').addEventListener('click', () => {
        window.location.href = '/user-list';
    });
    document.getElementById('view-results-self').addEventListener('click', viewStats);
    document.getElementById('go-home-self').addEventListener('click', goHome);
}

// 全局函数供按钮调用
function continueScan() {
    window.location.href = '/scan';
}

function viewStats() {
    window.location.href = '/mobile-stats';
}

function viewResults() {
    // 保留原有的管理页面跳转功能，以防其他地方需要
    window.location.href = '/admin';
}

function goHome() {
    window.location.href = '/';
}

function showLoading(message) {
    showMessage(message, 'loading');
}

function hideLoading() {
    const loadingMessage = document.querySelector('.message.loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showMessage(message, type) {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = message;
    
    // 插入到页面顶部
    const main = document.querySelector('main');
    main.insertBefore(messageDiv, main.firstChild);
    
    // 对于非加载消息，3秒后自动移除
    if (type !== 'loading') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}