// 移动端统计页面 JavaScript

// 本地缓存键名
const STORAGE_KEYS = {
    USER_ID: 'annual_party_user_id',
    USER_NAME: 'annual_party_user_name',
    USER_GENDER: 'annual_party_user_gender',
    NUMERIC_ID: 'annual_party_numeric_id',
    REGISTRATION_TIME: 'annual_party_registration_time'
};

document.addEventListener('DOMContentLoaded', function() {
    // 首先检查用户注册状态
    if (!checkUserRegistration()) {
        return; // 如果未注册，不继续初始化功能
    }
    
    // 初始化页面
    initializePage();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 加载初始数据
    loadAllData();
    
    // 设置自动刷新
    setAutoRefresh();
});

function checkUserRegistration() {
    const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    const userName = localStorage.getItem(STORAGE_KEYS.USER_NAME);
    const registrationTime = localStorage.getItem(STORAGE_KEYS.REGISTRATION_TIME);
    
    if (!userId || !userName || !registrationTime) {
        showUnregisteredMessage();
        return false;
    }
    
    // 检查注册时间是否在合理范围内（24小时内）
    const regTime = new Date(registrationTime);
    const now = new Date();
    const hoursDiff = (now - regTime) / (1000 * 60 * 60);
    
    if (hoursDiff >= 24) {
        // 清除过期的缓存
        clearRegistrationCache();
        showUnregisteredMessage();
        return false;
    }
    
    return true;
}

function clearRegistrationCache() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}

function showUnregisteredMessage() {
    const main = document.querySelector('main');
    main.innerHTML = `
        <div class="unregistered-notice">
            <div class="notice-content">
                <h2>⚠️ 需要先注册</h2>
                <p>您还没有注册参与年会最佳服装评选活动。</p>
                <p>只有注册用户才能查看投票统计。</p>
                <div class="notice-actions">
                    <a href="/" class="btn-primary">立即注册</a>
                    <a href="/" class="btn-secondary">返回首页</a>
                </div>
            </div>
        </div>
    `;
}

let refreshInterval;
let isLoading = false;

function initializePage() {
    // 更新时间显示
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    
    // 设置默认显示男士组
    showGenderRanking('male');
}

function bindEventListeners() {
    // 刷新按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleManualRefresh);
    }
    
    // 性别切换标签
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const gender = this.dataset.gender;
            switchGenderTab(gender);
        });
    });
    
    // 页面可见性变化时刷新数据
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            loadAllData();
        }
    });
    
    // 下拉刷新支持
    let startY = 0;
    let pullDistance = 0;
    const pullThreshold = 80;
    
    document.addEventListener('touchstart', function(e) {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
        }
    });
    
    document.addEventListener('touchmove', function(e) {
        if (window.scrollY === 0 && startY > 0) {
            pullDistance = e.touches[0].clientY - startY;
            if (pullDistance > 0 && pullDistance < pullThreshold * 2) {
                e.preventDefault();
                showPullRefreshHint(pullDistance >= pullThreshold);
            }
        }
    });
    
    document.addEventListener('touchend', function(e) {
        if (pullDistance >= pullThreshold) {
            handleManualRefresh();
        }
        hidePullRefreshHint();
        startY = 0;
        pullDistance = 0;
    });
}

function setAutoRefresh() {
    // 每30秒自动刷新数据
    refreshInterval = setInterval(loadAllData, 30000);
}

async function loadAllData() {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        // 并行加载所有数据
        await Promise.all([
            loadStatistics(),
            loadRankingData(),
            loadRecentActivity(),
            loadVotingProgress()
        ]);
        
        // 更新最后更新时间
        updateTimeDisplay();
        
    } catch (error) {
        console.error('Load data error:', error);
        showErrorMessage('数据加载失败，请检查网络连接');
    } finally {
        isLoading = false;
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/votes/statistics');
        const result = await response.json();
        
        if (result.success) {
            updateStatisticsDisplay(result.statistics);
        } else {
            throw new Error(result.message || '统计数据加载失败');
        }
    } catch (error) {
        console.error('Load statistics error:', error);
        showErrorInContainer('stats-overview', '统计数据加载失败');
    }
}

async function loadRankingData() {
    try {
        const response = await fetch('/api/votes/ranking');
        const result = await response.json();
        
        if (result.success) {
            updateRankingDisplay(result.ranking);
        } else {
            throw new Error(result.message || '排名数据加载失败');
        }
    } catch (error) {
        console.error('Load ranking error:', error);
        showErrorInContainer('maleRankingList', '排名数据加载失败');
        showErrorInContainer('femaleRankingList', '排名数据加载失败');
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch('/api/votes/recent-activity?limit=10');
        const result = await response.json();
        
        if (result.success) {
            updateRecentActivityDisplay(result.recentActivity);
        } else {
            throw new Error(result.message || '最近活动加载失败');
        }
    } catch (error) {
        console.error('Load recent activity error:', error);
        showErrorInContainer('recentVotesList', '最近活动加载失败');
    }
}

async function loadVotingProgress() {
    try {
        const response = await fetch('/api/votes/progress');
        const result = await response.json();
        
        if (result.success) {
            updateVotingProgressDisplay(result.progress);
        } else {
            throw new Error(result.message || '投票进度加载失败');
        }
    } catch (error) {
        console.error('Load voting progress error:', error);
        // 如果进度API不存在，使用统计数据计算
        calculateProgressFromStats();
    }
}

function updateStatisticsDisplay(stats) {
    // 更新统计数字
    updateElementText('totalParticipants', stats.totalParticipants || 0);
    updateElementText('totalVotes', stats.totalVotes || 0);
    updateElementText('maleParticipants', stats.maleParticipants || 0);
    updateElementText('femaleParticipants', stats.femaleParticipants || 0);
}

function updateRankingDisplay(ranking) {
    // 更新男士组排名
    updateGenderRankingList('maleRankingList', ranking.male || [], 'male');
    updateElementText('maleCount', `${(ranking.male || []).length}人参与`);
    
    // 更新女士组排名
    updateGenderRankingList('femaleRankingList', ranking.female || [], 'female');
    updateElementText('femaleCount', `${(ranking.female || []).length}人参与`);
}

function updateGenderRankingList(containerId, participants, gender) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (participants.length === 0) {
        container.innerHTML = createEmptyState('暂无参与者');
        return;
    }
    
    container.innerHTML = participants.map((participant, index) => {
        const rankClass = index < 3 ? ['first', 'second', 'third'][index] : '';
        const numberClass = index < 3 ? ['first', 'second', 'third'][index] : '';
        
        return `
            <div class="ranking-item ${rankClass}">
                <span class="ranking-number ${numberClass}">${index + 1}</span>
                <img src="${participant.avatarUrl || getDefaultAvatar(gender)}" 
                     alt="${participant.name}" class="ranking-avatar"
                     onerror="this.src='${getDefaultAvatar(gender)}'">
                <div class="ranking-info">
                    <div class="ranking-name">${participant.name}</div>
                    <div class="ranking-votes">
                        <span class="vote-count">${participant.voteCount || 0}</span> 票
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateRecentActivityDisplay(activities) {
    const container = document.getElementById('recentVotesList');
    if (!container) return;
    
    if (activities.length === 0) {
        container.innerHTML = createEmptyState('暂无最近投票');
        return;
    }
    
    container.innerHTML = activities.map(activity => {
        const timeAgo = getTimeAgo(activity.voteTime);
        
        return `
            <div class="activity-item">
                <img src="${activity.targetAvatar || getDefaultAvatar(activity.targetGender)}" 
                     alt="${activity.targetName}" class="activity-avatar"
                     onerror="this.src='${getDefaultAvatar(activity.targetGender)}'">
                <div class="activity-info">
                    <div class="activity-text">
                        ${activity.targetName} 获得一票
                        ${activity.voterName ? `(来自 ${activity.voterName})` : ''}
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
                <div class="activity-votes">
                    新投票
                </div>
            </div>
        `;
    }).join('');
}

function updateVotingProgressDisplay(progress) {
    if (!progress) return;
    
    // 计算投票率 - 基于活跃投票者数量
    const activeVoters = progress.activeVoters || 0;
    const maleVotesCast = progress.maleVotesCast || 0;
    const femaleVotesCast = progress.femaleVotesCast || 0;
    
    // 计算各性别的投票率（假设每个活跃投票者都应该为每个性别投票）
    const maleRate = activeVoters > 0 ? (maleVotesCast / activeVoters * 100) : 0;
    const femaleRate = activeVoters > 0 ? (femaleVotesCast / activeVoters * 100) : 0;
    
    // 更新男士组进度
    updateElementText('maleVoteRate', `${Math.round(maleRate)}%`);
    updateProgressBar('maleProgressBar', maleRate);
    
    // 更新女士组进度
    updateElementText('femaleVoteRate', `${Math.round(femaleRate)}%`);
    updateProgressBar('femaleProgressBar', femaleRate);
}

function calculateProgressFromStats() {
    // 如果没有专门的进度API，从统计数据估算
    // 这里假设每个参与者最多能获得总参与者数量的票数
    const totalParticipants = parseInt(document.getElementById('totalParticipants').textContent) || 0;
    const totalVotes = parseInt(document.getElementById('totalVotes').textContent) || 0;
    
    if (totalParticipants > 0) {
        // 简单估算：假设投票均匀分布
        const estimatedRate = Math.min((totalVotes / (totalParticipants * 2)) * 100, 100);
        
        updateElementText('maleVoteRate', `${Math.round(estimatedRate)}%`);
        updateProgressBar('maleProgressBar', estimatedRate);
        
        updateElementText('femaleVoteRate', `${Math.round(estimatedRate)}%`);
        updateProgressBar('femaleProgressBar', estimatedRate);
    }
}

function switchGenderTab(gender) {
    // 更新标签状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === gender);
    });
    
    // 显示对应的排名内容
    showGenderRanking(gender);
}

function showGenderRanking(gender) {
    document.querySelectorAll('.ranking-content').forEach(content => {
        content.classList.toggle('active', content.id === `${gender}Ranking`);
    });
}

function handleManualRefresh() {
    if (isLoading) return;
    
    // 添加刷新动画
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(180deg)';
        setTimeout(() => {
            refreshBtn.style.transform = '';
        }, 300);
    }
    
    // 重新加载数据
    loadAllData();
}

function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    updateElementText('lastUpdateTime', timeString);
}

function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function updateProgressBar(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
}

function getDefaultAvatar(gender) {
    return gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg';
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return time.toLocaleDateString('zh-CN');
}

function createEmptyState(message) {
    return `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
            </svg>
            <div>${message}</div>
        </div>
    `;
}

function showErrorMessage(message) {
    // 创建错误提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.textContent = message;
    
    // 插入到主容器顶部
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(errorDiv, main.firstChild);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
}

function showErrorInContainer(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error-state">${message}</div>`;
    }
}

function showPullRefreshHint(canRefresh) {
    let hint = document.querySelector('.pull-refresh-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'pull-refresh-hint';
        document.body.appendChild(hint);
    }
    
    hint.textContent = canRefresh ? '松开刷新' : '下拉刷新';
    hint.classList.add('show');
}

function hidePullRefreshHint() {
    const hint = document.querySelector('.pull-refresh-hint');
    if (hint) {
        hint.classList.remove('show');
    }
}

// 页面卸载时清理定时器
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// 网络状态监听
window.addEventListener('online', function() {
    loadAllData();
});

window.addEventListener('offline', function() {
    showErrorMessage('网络连接已断开');
});