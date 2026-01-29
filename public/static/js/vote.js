// 投票页面逻辑
document.addEventListener('DOMContentLoaded', function() {
    initializeVotePage();
});

let currentCandidate = null;
let currentUser = null;

/**
 * 初始化投票页面
 */
async function initializeVotePage() {
    try {
        // 从URL路径中提取候选人ID
        const candidateId = extractCandidateIdFromPath();
        console.log('Extracted candidate ID:', candidateId);
        
        if (!candidateId) {
            showError('参数错误', '缺少候选人ID');
            return;
        }

        // 检查用户认证状态
        const authStatus = await checkAuthStatus();
        console.log('Auth status:', authStatus);
        
        if (!authStatus.isLoggedIn) {
            showAuthPrompt(candidateId);
            return;
        }

        currentUser = authStatus.user;
        console.log('Current user set:', currentUser);

        // 获取候选人信息
        const candidate = await fetchCandidateInfo(candidateId);
        console.log('Fetched candidate:', candidate);
        
        if (!candidate) {
            showError('候选人不存在', '无法找到指定的候选人信息');
            return;
        }

        currentCandidate = candidate;
        console.log('Current candidate set:', currentCandidate);

        // 直接显示投票界面，不在此处检查投票资格
        // 投票资格检查将在用户点击投票按钮时进行
        showVoteInterface();
        
    } catch (error) {
        console.error('Vote page initialization error:', error);
        showError('初始化失败', '页面加载出现错误，请重试');
    }
}

/**
 * 从URL路径中提取候选人ID
 * @returns {string|null} 候选人ID
 */
function extractCandidateIdFromPath() {
    const path = window.location.pathname;
    const match = path.match(/\/vote\/(.+)$/);
    return match ? match[1] : null;
}

/**
 * 检查用户认证状态
 * @returns {Promise<Object>} 认证状态
 */
async function checkAuthStatus() {
    try {
        // 检查本地存储中的注册信息
        const userId = localStorage.getItem('annual_party_user_id');
        const userName = localStorage.getItem('annual_party_user_name');
        const userGender = localStorage.getItem('annual_party_user_gender');
        const registrationTime = localStorage.getItem('annual_party_registration_time');
        
        // 验证注册信息的完整性
        if (userId && userName && registrationTime) {
            // 验证注册信息的有效性（24小时时间窗口）
            if (isRegistrationValid(registrationTime)) {
                return {
                    isLoggedIn: true,
                    user: {
                        id: userId,
                        username: userName,
                        gender: userGender,
                        registrationTime: registrationTime
                    }
                };
            } else {
                // 注册信息已过期，清理本地存储
                clearExpiredRegistration();
                console.warn('Registration expired, cleared local storage');
            }
        }
        
        return {
            isLoggedIn: false
        };
    } catch (error) {
        console.error('Error checking auth status:', error);
        return {
            isLoggedIn: false,
            error: error.message
        };
    }
}

/**
 * 验证注册信息的有效性（24小时时间窗口）
 * @param {string} registrationTime - 注册时间字符串
 * @returns {boolean} 注册是否有效
 */
function isRegistrationValid(registrationTime) {
    try {
        if (!registrationTime) return false;
        
        const regTime = new Date(registrationTime);
        const now = new Date();
        
        // 检查时间格式是否有效
        if (isNaN(regTime.getTime())) {
            console.warn('Invalid registration time format:', registrationTime);
            return false;
        }
        
        // 计算时间差（小时）
        const hoursDiff = (now - regTime) / (1000 * 60 * 60);
        
        // 24小时内的注册被认为是有效的
        return hoursDiff < 24 && hoursDiff >= 0;
    } catch (error) {
        console.error('Error validating registration time:', error);
        return false;
    }
}

/**
 * 清理过期的注册信息
 */
function clearExpiredRegistration() {
    try {
        const keysToRemove = [
            'annual_party_user_id',
            'annual_party_user_name',
            'annual_party_user_gender',
            'annual_party_numeric_id',
            'annual_party_registration_time'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log('Expired registration data cleared');
    } catch (error) {
        console.error('Error clearing expired registration:', error);
    }
}

/**
 * 获取候选人信息
 * @param {string} candidateId - 候选人ID
 * @returns {Promise<Object|null>} 候选人信息
 */
async function fetchCandidateInfo(candidateId) {
    try {
        const response = await fetch(`/api/users/${candidateId}`);
        const result = await response.json();
        
        if (result.success) {
            return {
                id: candidateId,
                numericId: result.numericId, // 添加6位数字ID
                name: result.name,
                gender: result.gender,
                avatarUrl: result.avatarUrl,
                voteCount: result.voteCount || 0,
                category: result.gender === 'male' ? '最佳男士' : '最佳女士'
            };
        } else {
            console.error('Failed to fetch candidate info:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Error fetching candidate info:', error);
        return null;
    }
}

/**
 * 检查投票资格
 * @param {string} candidateId - 候选人ID
 * @returns {Promise<Object>} 投票资格检查结果
 */
async function checkVotingEligibility(candidateId) {
    try {
        // 检查是否为自己投票
        if (currentUser && candidateId === currentUser.id) {
            return {
                eligible: false,
                reason: '不能为自己投票',
                details: {
                    allowedActions: ['为其他参与者投票', '查看投票结果']
                }
            };
        }
        
        // 检查投票资格
        const response = await fetch('/api/votes/check-eligibility', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voterId: currentUser.id,
                targetUserId: candidateId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            let details = null;
            
            // 如果不能投票，构建详细信息
            if (!result.canVote && result.voterStatus) {
                const targetGender = result.targetUser ? result.targetUser.gender : null;
                const votedUsers = result.voterStatus.votedUsers || [];
                
                // 找到已投票的同性别用户
                let votedUser = null;
                if (targetGender === 'male' && result.voterStatus.maleVoted) {
                    votedUser = votedUsers.find(user => user.gender === 'male');
                } else if (targetGender === 'female' && result.voterStatus.femaleVoted) {
                    votedUser = votedUsers.find(user => user.gender === 'female');
                }
                
                details = {
                    votedUser: votedUser ? votedUser.name : null,
                    targetGender: targetGender === 'male' ? '男士' : '女士',
                    allowedActions: [
                        '查看投票结果',
                        `为${targetGender === 'male' ? '女士' : '男士'}参与者投票`
                    ]
                };
            }
            
            return {
                eligible: result.canVote,
                reason: result.reason || null,
                details: details
            };
        } else {
            console.error('Eligibility check failed:', result.message);
            // 如果检查失败，允许投票但在提交时再次验证
            return {
                eligible: true
            };
        }
    } catch (error) {
        console.error('Error checking voting eligibility:', error);
        // 如果检查失败，允许投票但在提交时再次验证
        return {
            eligible: true
        };
    }
}

/**
 * 显示错误状态
 * @param {string} title - 错误标题
 * @param {string} message - 错误消息
 * @param {Object} details - 详细错误信息（可选）
 */
function showError(title, message, details = null) {
    hideAllStates();
    document.getElementById('errorState').style.display = 'block';
    document.querySelector('#errorState .error-title').textContent = title;
    
    const errorMessageEl = document.getElementById('errorMessage');
    const errorDetailsEl = document.getElementById('errorDetails');
    const errorActionsEl = document.getElementById('errorActions');
    
    // 设置主要错误消息
    errorMessageEl.textContent = message;
    
    // 清空之前的详细信息和操作建议
    if (errorDetailsEl) {
        errorDetailsEl.innerHTML = '';
        errorDetailsEl.style.display = 'none';
    }
    if (errorActionsEl) {
        errorActionsEl.innerHTML = '';
        errorActionsEl.style.display = 'none';
    }
    
    // 如果有详细信息，显示它们
    if (details) {
        if (details.votedUser && errorDetailsEl) {
            errorDetailsEl.innerHTML = `
                <div class="error-detail-item">
                    <strong>已投票用户：</strong>${details.votedUser}
                </div>
            `;
            errorDetailsEl.style.display = 'block';
        }
        
        if (details.allowedActions && details.allowedActions.length > 0 && errorActionsEl) {
            const actionsHtml = details.allowedActions.map(action => 
                `<li class="allowed-action">${action}</li>`
            ).join('');
            
            errorActionsEl.innerHTML = `
                <div class="suggestions-title">您可以：</div>
                <ul class="suggestions-list">${actionsHtml}</ul>
            `;
            errorActionsEl.style.display = 'block';
        }
    }
}

/**
 * 显示认证提示
 * @param {string} candidateId - 候选人ID
 */
function showAuthPrompt(candidateId) {
    hideAllStates();
    document.getElementById('authPrompt').style.display = 'block';
    
    // 设置登录按钮的返回URL
    const loginBtn = document.getElementById('loginBtn');
    const returnUrl = encodeURIComponent(`/vote/${candidateId}`);
    loginBtn.href = `/?return=${returnUrl}`;
}

/**
 * 显示投票界面
 */
function showVoteInterface() {
    hideAllStates();
    document.getElementById('voteInterface').style.display = 'block';
    
    // 验证必要的数据
    if (!currentCandidate) {
        console.error('currentCandidate is null or undefined');
        showError('数据错误', '候选人信息丢失，请刷新页面重试');
        return;
    }
    
    if (!currentUser) {
        console.error('currentUser is null or undefined');
        showError('数据错误', '用户信息丢失，请重新登录');
        return;
    }
    
    console.log('Current candidate:', currentCandidate);
    console.log('Current user:', currentUser);
    
    // 设置投票来源标识
    const voteSource = document.getElementById('voteSource');
    const referrer = document.referrer;
    
    if (referrer.includes('/scan')) {
        voteSource.textContent = '📱 扫码投票';
        voteSource.className = 'vote-source qrcode';
        voteSource.style.display = 'inline-block';
    } else if (referrer.includes('/user-list')) {
        voteSource.textContent = '👥 按姓名投票';
        voteSource.className = 'vote-source search';
        voteSource.style.display = 'inline-block';
    } else {
        // 隐藏直接访问标识
        voteSource.style.display = 'none';
    }
    
    // 设置候选人信息
    const avatarEl = document.getElementById('candidateAvatar');
    const nameEl = document.getElementById('candidateName');
    const idEl = document.getElementById('candidateId');
    const categoryEl = document.getElementById('candidateCategory');
    
    nameEl.textContent = currentCandidate.name || '未知候选人';
    // 优先显示6位数字ID，如果没有则显示字符串ID
    const displayId = currentCandidate.numericId || currentCandidate.id || '未知';
    idEl.textContent = `ID: ${displayId}`;
    categoryEl.textContent = currentCandidate.category || '未知类别';
    
    // 设置头像
    if (currentCandidate.avatarUrl) {
        avatarEl.src = currentCandidate.avatarUrl;
        avatarEl.onerror = function() {
            this.src = getDefaultAvatar(currentCandidate.gender);
        };
    } else {
        avatarEl.src = getDefaultAvatar(currentCandidate.gender);
    }
    
    // 设置投票按钮事件
    document.getElementById('voteBtn').onclick = submitVote;
}

/**
 * 获取默认头像
 * @param {string} gender - 性别
 * @returns {string} 头像URL
 */
function getDefaultAvatar(gender) {
    return gender === 'female' 
        ? '/static/images/default-female-avatar.svg'
        : '/static/images/default-male-avatar.svg';
}

/**
 * 提交投票
 */
async function submitVote() {
    const voteBtn = document.getElementById('voteBtn');
    const originalText = voteBtn.innerHTML;
    
    try {
        // 验证必要的数据
        if (!currentUser || !currentUser.id) {
            throw new Error('用户信息无效，请重新登录');
        }
        
        if (!currentCandidate || !currentCandidate.id) {
            throw new Error('候选人信息无效，请刷新页面重试');
        }
        
        voteBtn.innerHTML = '⏳ 检查投票资格...';
        voteBtn.disabled = true;
        
        // 在提交前检查投票资格
        const eligibility = await checkVotingEligibility(currentCandidate.id);
        console.log('Voting eligibility check:', eligibility);
        
        if (!eligibility.eligible) {
            // 显示详细的投票限制信息
            showVotingRestrictionError(eligibility.reason, eligibility.details);
            return;
        }
        
        voteBtn.innerHTML = '⏳ 投票中...';
        
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voterId: currentUser.id,
                targetUserId: currentCandidate.id, // 修正参数名
                voteMethod: 'name_search' // 标记为按姓名投票
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`您已成功为 ${currentCandidate.name} 投票！`);
        } else {
            // 处理API返回的详细错误信息
            handleVoteSubmissionError(result);
        }
        
    } catch (error) {
        console.error('Vote submission error:', error);
        
        // 恢复按钮状态
        voteBtn.innerHTML = originalText;
        voteBtn.disabled = false;
        
        // 显示错误信息
        let errorMessage = '投票失败，请重试';
        
        if (error.message.includes('用户信息无效')) {
            errorMessage = '用户信息无效，请重新登录';
        } else if (error.message.includes('候选人信息无效')) {
            errorMessage = '候选人信息无效，请刷新页面重试';
        } else if (error.message.includes('网络')) {
            errorMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message) {
            errorMessage = error.message; // 使用具体的错误信息
        }
        
        showError('投票失败', errorMessage);
    }
}

/**
 * 显示投票限制错误信息
 * @param {string} reason - 限制原因
 * @param {Object} details - 详细信息（可选）
 */
function showVotingRestrictionError(reason, details = null) {
    const voteBtn = document.getElementById('voteBtn');
    voteBtn.innerHTML = '🗳️ 投票支持';
    voteBtn.disabled = false;
    
    let title = '投票受限';
    let message = reason || '您暂时无法为该候选人投票';
    
    if (reason && reason.includes('不能为自己投票')) {
        title = '无法投票';
        message = '系统不允许为自己投票';
    } else if (reason && (reason.includes('男士') || reason.includes('女士'))) {
        title = '重复投票';
        message = reason;
    }
    
    showError(title, message, details);
}

/**
 * 处理投票提交错误
 * @param {Object} result - API返回的错误结果
 */
function handleVoteSubmissionError(result) {
    const voteBtn = document.getElementById('voteBtn');
    voteBtn.innerHTML = '🗳️ 投票支持';
    voteBtn.disabled = false;
    
    let title = '投票失败';
    let message = result.message || '投票提交失败，请重试';
    let details = result.details || null;
    
    // 根据错误代码提供更友好的错误信息
    switch (result.errorCode) {
        case 'SELF_VOTE_NOT_ALLOWED':
            title = '无法投票';
            message = '系统不允许为自己投票';
            break;
            
        case 'DUPLICATE_VOTE':
            title = '重复投票';
            // 使用API返回的详细消息
            break;
            
        case 'TARGET_USER_NOT_FOUND':
            title = '候选人不存在';
            message = '无法找到指定的候选人，请刷新页面重试';
            break;
            
        case 'MISSING_REQUIRED_FIELDS':
            title = '参数错误';
            message = '投票信息不完整，请刷新页面重试';
            break;
            
        case 'VOTE_SUBMISSION_FAILED':
            title = '系统错误';
            message = '服务器暂时无法处理投票请求，请稍后重试';
            break;
    }
    
    showError(title, message, details);
}

/**
 * 显示成功状态
 * @param {string} message - 成功消息
 */
function showSuccess(message) {
    hideAllStates();
    document.getElementById('successState').style.display = 'block';
    document.getElementById('successMessage').textContent = message;
}

/**
 * 隐藏所有状态
 */
function hideAllStates() {
    const states = ['loadingState', 'errorState', 'authPrompt', 'voteInterface', 'successState'];
    states.forEach(stateId => {
        document.getElementById(stateId).style.display = 'none';
    });
}

// 处理浏览器返回按钮
window.addEventListener('popstate', function(event) {
    // 如果用户点击返回，重新初始化页面
    initializeVotePage();
});

// 处理页面可见性变化（移动端优化）
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 页面重新可见时，检查是否需要刷新数据
        const currentState = getCurrentState();
        if (currentState === 'error') {
            // 如果当前是错误状态，尝试重新初始化
            initializeVotePage();
        }
    }
});

/**
 * 获取当前页面状态
 * @returns {string} 当前状态
 */
function getCurrentState() {
    const states = ['loadingState', 'errorState', 'authPrompt', 'voteInterface', 'successState'];
    
    for (const stateId of states) {
        const element = document.getElementById(stateId);
        if (element && element.style.display !== 'none') {
            return stateId.replace('State', '').toLowerCase();
        }
    }
    
    return 'loading';
}