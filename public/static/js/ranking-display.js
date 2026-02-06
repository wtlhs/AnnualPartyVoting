// 电脑端排名展示页面 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    loadRankingData();

    // 启动自动刷新（由空格键控制暂停/恢复）
    startAutoRefresh();

    // 更新时间显示
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);

    // 添加键盘快捷键提示
    showKeyboardShortcuts();
});

async function loadRankingData() {
    try {
        // 加载统计数据
        const statsResponse = await fetch('/api/votes/statistics');

        if (statsResponse.status === 429) {
            console.warn('Statistics API rate limited, retrying in 5 seconds...');
            showNotification('数据刷新过于频繁，5秒后重试', 'info');
            if (autoRefreshEnabled) {
                setTimeout(loadRankingData, 5000);
            }
            return;
        }

        const statsResult = await statsResponse.json();

        if (statsResult.success) {
            updateStatsDisplay(statsResult.statistics);
        }

        // 加载排名数据
        const rankingResponse = await fetch('/api/votes/ranking');

        if (rankingResponse.status === 429) {
            console.warn('Ranking API rate limited, retrying in 5 seconds...');
            showNotification('排名数据刷新过于频繁，5秒后重试', 'info');
            if (autoRefreshEnabled) {
                setTimeout(loadRankingData, 5000);
            }
            return;
        }

        const rankingResult = await rankingResponse.json();

        if (rankingResult.success) {
            updateRankingDisplay(rankingResult.ranking);
        }

        // 更新最后更新时间
        const lastUpdateElement = document.getElementById('lastUpdateTime');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleTimeString('zh-CN');
        }

        // 添加成功加载的视觉反馈
        flashUpdateIndicator();

    } catch (error) {
        console.error('Load ranking data error:', error);
        showConnectionError();

        // 如果是网络错误，5秒后重试
        if (autoRefreshEnabled) {
            setTimeout(loadRankingData, 5000);
        }
    }
}

function updateStatsDisplay(stats) {
    // 添加安全检查
    if (!stats) {
        console.warn('Stats data is undefined or null');
        return;
    }

    // 更新总参与人数（移除动画效果，与其他项保持一致）
    document.getElementById('displayTotalParticipants').textContent = stats.totalParticipants || 0;
}

function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    
    // 添加元素存在性检查
    if (!element) {
        console.warn(`Element with ID '${elementId}' not found`);
        return;
    }
    
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === targetValue) return;
    
    const duration = 1000; // 1秒动画
    const steps = 30;
    const stepValue = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = newValue;
        
        if (currentStep >= steps) {
            clearInterval(timer);
            element.textContent = targetValue;
        }
    }, stepDuration);
}

function updateRankingDisplay(ranking) {
    // 添加安全检查
    if (!ranking) {
        console.warn('Ranking data is undefined or null');
        return;
    }

    updateGenderRankingDisplay('maleRankingDisplay', ranking.male || [], 'male');
    updateGenderRankingDisplay('femaleRankingDisplay', ranking.female || [], 'female');

    // 更新性别统计
    updateGenderStats(ranking);
}

/**
 * 更新性别统计（参与人数和投票进度）
 */
function updateGenderStats(ranking) {
    if (!ranking) return;

    const maleParticipants = ranking.male || [];
    const femaleParticipants = ranking.female || [];

    // 统计男士和女士的人数
    const maleCount = maleParticipants.length;
    const femaleCount = femaleParticipants.length;

    // 统计男士和女士获得的票数（用于显示）
    const maleVoteReceived = maleParticipants.reduce((sum, p) => sum + (p.voteCount || 0), 0);
    const femaleVoteReceived = femaleParticipants.reduce((sum, p) => sum + (p.voteCount || 0), 0);

    // 从 progress API 获取投票进度数据
    fetch('/api/votes/progress')
        .then(response => response.json())
        .then(result => {
            if (result.success && result.progress) {
                const progress = result.progress;

                // 使用 progress API 返回的正确数据
                // 男士组：已投出票数 / 应投出票数（人数 × 2）
                const maleCastTotal = progress.maleCastTotal || 0;
                const maleExpectedTotal = maleCount * 2;
                const maleRate = maleExpectedTotal > 0 ? Math.round((maleCastTotal / maleExpectedTotal) * 100) : 0;

                // 女士组：已投出票数 / 应投出票数（人数 × 2）
                const femaleCastTotal = progress.femaleCastTotal || 0;
                const femaleExpectedTotal = femaleCount * 2;
                const femaleRate = femaleExpectedTotal > 0 ? Math.round((femaleCastTotal / femaleExpectedTotal) * 100) : 0;

                // 更新显示
                document.getElementById('maleParticipants').textContent = maleCount;
                document.getElementById('maleVotes').textContent = `${maleCastTotal}/${maleExpectedTotal}`;
                document.getElementById('maleRate').textContent = `${maleRate}%`;

                document.getElementById('femaleParticipants').textContent = femaleCount;
                document.getElementById('femaleVotes').textContent = `${femaleCastTotal}/${femaleExpectedTotal}`;
                document.getElementById('femaleRate').textContent = `${femaleRate}%`;
            } else {
                // 降级方案：使用旧逻辑（获得的票数）
                updateGenderStatsFallback(maleCount, femaleCount, maleVoteReceived, femaleVoteReceived);
            }
        })
        .catch(error => {
            console.warn('Failed to load progress data:', error);
            // 降级方案：使用旧逻辑（获得的票数）
            updateGenderStatsFallback(maleCount, femaleCount, maleVoteReceived, femaleVoteReceived);
        });
}

/**
 * 降级方案：使用获得的票数计算（不准确，但保证不会出错）
 */
function updateGenderStatsFallback(maleCount, femaleCount, maleVoteReceived, femaleVoteReceived) {
    const maleExpectedTotal = maleCount * 2;
    const femaleExpectedTotal = femaleCount * 2;
    const maleRate = maleExpectedTotal > 0 ? Math.round((maleVoteReceived / maleExpectedTotal) * 100) : 0;
    const femaleRate = femaleExpectedTotal > 0 ? Math.round((femaleVoteReceived / femaleExpectedTotal) * 100) : 0;

    document.getElementById('maleParticipants').textContent = maleCount;
    document.getElementById('maleVotes').textContent = `${maleVoteReceived}/${maleExpectedTotal}`;
    document.getElementById('maleRate').textContent = `${maleRate}%`;

    document.getElementById('femaleParticipants').textContent = femaleCount;
    document.getElementById('femaleVotes').textContent = `${femaleVoteReceived}/${femaleExpectedTotal}`;
    document.getElementById('femaleRate').textContent = `${femaleRate}%`;
}

function updateGenderRankingDisplay(containerId, participants, gender) {
    const container = document.getElementById(containerId);
    
    if (participants.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无参与者</div>';
        return;
    }
    
    // 显示所有参与者，但突出前三名
    container.innerHTML = participants.map((participant, index) => {
        const rankClass = index < 3 ? ['first', 'second', 'third'][index] : '';
        const numberClass = index < 3 ? ['first', 'second', 'third'][index] : '';
        
        // 添加奖牌图标
        const medalIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        return `
            <div class="display-ranking-item ${rankClass}" data-rank="${index + 1}">
                <span class="display-ranking-number ${numberClass}">
                    ${medalIcon ? medalIcon : index + 1}
                </span>
                <img src="${participant.avatarUrl || getDefaultAvatar(gender)}" 
                     alt="${participant.name}" class="display-ranking-avatar"
                     onerror="handleAvatarError(this, '${gender}')">
                <div class="display-ranking-info">
                    <div class="display-ranking-name">${participant.name}</div>
                    <div class="display-ranking-votes">${participant.voteCount || 0} 票</div>
                </div>
            </div>
        `;
    }).join('');
    
    // 添加进入动画
    const items = container.querySelectorAll('.display-ranking-item');
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        setTimeout(() => {
            item.style.transition = 'all 0.5s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function getDefaultAvatar(gender) {
    return gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg';
}

function handleAvatarError(img, gender) {
    const avatarUrl = img.src;
    console.warn('Avatar failed to load:', avatarUrl);
    
    // 如果是完整的 URL，尝试转为相对路径
    if (avatarUrl && avatarUrl.startsWith('http')) {
        try {
            const url = new URL(avatarUrl);
            img.src = url.pathname;
            console.log('Retrying with relative path:', url.pathname);
            
            // 如果相对路径也失败，则加载默认头像
            img.onerror = function() {
                this.src = getDefaultAvatar(gender);
                this.onerror = null;
            };
        } catch (e) {
            img.src = getDefaultAvatar(gender);
        }
    } else {
        img.src = getDefaultAvatar(gender);
    }
}

function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // 更新当前时间
    const currentTimeElement = document.getElementById('currentTime');
    if (currentTimeElement) {
        currentTimeElement.textContent = timeString;
    }

    // 如果页面上有其他时间显示元素，也更新它
    const timeElements = document.querySelectorAll('.current-time');
    timeElements.forEach(element => {
        if (element.id !== 'currentTime') {
            element.textContent = timeString;
        }
    });
}

function showConnectionError() {
    const containers = ['maleRankingDisplay', 'femaleRankingDisplay'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="loading">连接失败，正在重试...</div>';
        }
    });
    
    // 显示错误通知
    showNotification('数据加载失败，正在重试...', 'error');
}

function flashUpdateIndicator() {
    const updateElement = document.getElementById('lastUpdateTime');
    if (updateElement) {
        updateElement.style.background = 'rgba(40, 167, 69, 0.3)';
        updateElement.style.transition = 'background 0.3s ease';
        
        setTimeout(() => {
            updateElement.style.background = 'rgba(255, 255, 255, 0.15)';
        }, 1000);
    } else {
        console.warn('lastUpdateTime element not found');
    }
}

function showKeyboardShortcuts() {
    // 在页面底部显示快捷键提示
    const footer = document.querySelector('.display-footer');
    if (footer) {
        const shortcutsText = footer.innerHTML;
        footer.innerHTML = `
            ${shortcutsText}
            <div style="margin-top: 10px; font-size: 14px; opacity: 0.7;">
                快捷键: F5 刷新数据 | F11 全屏切换 | Esc 退出全屏 | 空格键 暂停/恢复自动刷新
            </div>
        `;
    }
}

// 页面可见性API - 当页面重新可见时刷新数据
document.addEventListener('visibilitychange', function() {
    // 只有在自动刷新启用时才刷新
    if (!document.hidden && autoRefreshEnabled) {
        loadRankingData();
    }
});

// 自动刷新控制
let autoRefreshEnabled = true;
let refreshInterval = null;

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;

    if (autoRefreshEnabled) {
        // 清除可能存在的旧 interval
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        // 创建新的 interval
        refreshInterval = setInterval(loadRankingData, 30000);
        showNotification('自动刷新已启用', 'success');
    } else {
        // 清除 interval 并重置变量
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        showNotification('自动刷新已暂停', 'info');
    }
}

// 启动自动刷新
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(loadRankingData, 30000);
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 键盘快捷键
document.addEventListener('keydown', function(event) {
    // 按F5或Ctrl+R刷新数据
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        event.preventDefault();
        loadRankingData();
        showNotification('数据已刷新', 'success');
    }
    
    // 按F11进入/退出全屏
    if (event.key === 'F11') {
        event.preventDefault();
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                showNotification('已退出全屏', 'info');
            }).catch(() => {
                showNotification('退出全屏失败', 'error');
            });
        } else {
            document.documentElement.requestFullscreen().then(() => {
                showNotification('已进入全屏模式 (按F11退出)', 'success');
            }).catch(() => {
                showNotification('无法进入全屏模式', 'error');
            });
        }
    }

    // 按Escape键退出全屏（仅在全屏时有效）
    if (event.key === 'Escape' && document.fullscreenElement) {
        // Escape会自动退出全屏，只需显示提示
        setTimeout(() => {
            showNotification('已退出全屏', 'info');
        }, 100);
    }
    
    // 按空格键暂停/恢复自动刷新
    if (event.code === 'Space') {
        event.preventDefault();
        toggleAutoRefresh();
    }
    
    // 按数字键1-9快速跳转到对应排名
    if (event.key >= '1' && event.key <= '9') {
        const rank = parseInt(event.key);
        const targetElement = document.querySelector(`[data-rank="${rank}"]`);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 高亮显示
            targetElement.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.8)';
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 2000);
        }
    }
});

// 鼠标滚轮优化
document.addEventListener('wheel', function(event) {
    // 平滑滚动
    if (event.deltaY !== 0) {
        event.preventDefault();
        window.scrollBy({
            top: event.deltaY * 0.5,
            behavior: 'smooth'
        });
    }
});

// 初始化自动刷新
startAutoRefresh();