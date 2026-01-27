// 管理后台页面 JavaScript - PC端优化版本
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

let adminToken = localStorage.getItem('admin_token');
let currentSection = 'dashboard';
let refreshInterval = null;

function initializeAdmin() {
    checkAdminAuth();
    setupEventListeners();
}

function setupEventListeners() {
    // 侧边栏切换
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // 全屏切换
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'r':
                event.preventDefault();
                loadCurrentSectionData();
                break;
            case 'f':
                event.preventDefault();
                toggleFullscreen();
                break;
        }
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const main = document.querySelector('.admin-main');
    
    sidebar.classList.toggle('show');
    main.classList.toggle('expanded');
}

function toggleFullscreen() {
    const layout = document.querySelector('.admin-layout');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const icon = fullscreenBtn.querySelector('i');
    const text = fullscreenBtn.querySelector('span');
    
    layout.classList.toggle('fullscreen');
    
    if (layout.classList.contains('fullscreen')) {
        icon.className = 'fas fa-compress';
        text.textContent = '退出全屏';
        fullscreenBtn.title = '退出全屏';
    } else {
        icon.className = 'fas fa-expand';
        text.textContent = '全屏显示';
        fullscreenBtn.title = '全屏显示';
    }
}

function checkAdminAuth() {
    if (!adminToken) {
        showLoginForm();
        return;
    }
    
    // 验证token是否有效
    verifyToken().then(valid => {
        if (valid) {
            showAdminInterface();
            loadCurrentSectionData();
            startAutoRefresh();
        } else {
            showLoginForm();
        }
    });
}

async function verifyToken() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

function showLoginForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="admin-login">
            <h2><i class="fas fa-lock"></i> 管理员登录</h2>
            <form id="loginForm">
                <div class="form-group">
                    <label for="password">管理员密码</label>
                    <input type="password" id="password" name="password" required 
                           placeholder="请输入管理员密码" autocomplete="current-password">
                </div>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-sign-in-alt"></i>
                    登录
                </button>
            </form>
        </div>
    `;
    
    // 隐藏侧边栏和头部
    const sidebar = document.querySelector('.admin-sidebar');
    const header = document.querySelector('.admin-header');
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('password').focus();
}

async function handleLogin(event) {
    event.preventDefault();
    
    const password = document.getElementById('password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    if (!password) {
        showError('请输入管理员密码');
        return;
    }
    
    // 禁用按钮并显示加载状态
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            adminToken = result.token;
            localStorage.setItem('admin_token', adminToken);
            showSuccess('登录成功，正在加载管理面板...');
            
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showError(result.message || '登录失败，请检查密码');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('登录失败，请检查网络连接');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
    }
}

function showAdminInterface() {
    // 显示侧边栏和头部
    const sidebar = document.querySelector('.admin-sidebar');
    const header = document.querySelector('.admin-header');
    if (sidebar) sidebar.style.display = 'block';
    if (header) header.style.display = 'flex';
    
    setupNavigation();
    setupHeaderActions();
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });
    
    // 设置退出登录按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

function setupHeaderActions() {
    const refreshAllBtn = document.getElementById('refreshAllBtn');
    if (refreshAllBtn) {
        refreshAllBtn.addEventListener('click', () => {
            loadCurrentSectionData();
            showSuccess('数据已刷新');
        });
    }
}

function switchSection(section) {
    currentSection = section;
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // 更新页面标题
    const titles = {
        dashboard: '仪表盘',
        participants: '参与者管理',
        voting: '投票统计',
        winners: '获奖名单',
        settings: '系统设置'
    };
    document.getElementById('pageTitle').textContent = titles[section] || '管理后台';
    
    // 加载对应内容
    loadCurrentSectionData();
}

async function loadCurrentSectionData() {
    const loadingIcon = document.querySelector('#refreshAllBtn i');
    if (loadingIcon) {
        loadingIcon.classList.add('fa-spin');
    }
    
    try {
        switch (currentSection) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'participants':
                await loadParticipants();
                break;
            case 'voting':
                await loadVotingStats();
                break;
            case 'winners':
                await loadWinners();
                break;
            case 'settings':
                await loadSettings();
                break;
        }
    } catch (error) {
        console.error('Load section data error:', error);
        showError('加载数据失败，请重试');
    } finally {
        if (loadingIcon) {
            loadingIcon.classList.remove('fa-spin');
        }
    }
}

async function loadDashboard() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="card-header">
                    <h3 class="card-title">统计概览</h3>
                    <div class="card-icon stats">
                        <i class="fas fa-chart-bar"></i>
                    </div>
                </div>
                <div class="stats-overview">
                    <div class="stat-card">
                        <h3>总参与人数</h3>
                        <span id="totalParticipants">0</span>
                        <div class="stat-change">+0 今日新增</div>
                    </div>
                    <div class="stat-card">
                        <h3>总投票数</h3>
                        <span id="totalVotes">0</span>
                        <div class="stat-change">+0 今日新增</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <i class="fas fa-mars"></i>
                        </div>
                        <div class="stat-info">
                            <h3>男士参与者</h3>
                            <p class="stat-number" id="maleParticipants">0</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon pink">
                            <i class="fas fa-venus"></i>
                        </div>
                        <div class="stat-info">
                            <h3>女士参与者</h3>
                            <p class="stat-number" id="femaleParticipants">0</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="rankings">
            <div class="ranking-section">
                <h2><i class="fas fa-mars"></i> 男士前三名</h2>
                <div id="maleRanking" class="ranking-list">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        加载中...
                    </div>
                </div>
            </div>
            
            <div class="ranking-section">
                <h2><i class="fas fa-venus"></i> 女士前三名</h2>
                <div id="femaleRanking" class="ranking-list">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        加载中...
                    </div>
                </div>
            </div>
        </div>
        
        <div class="recent-activity">
            <h2><i class="fas fa-clock"></i> 最近投票活动</h2>
            <div id="recentActivity" class="activity-list">
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    加载中...
                </div>
            </div>
        </div>
        
        <div class="admin-actions">
            <button id="exportResultsBtn" class="btn-primary">
                <i class="fas fa-download"></i>
                导出结果
            </button>
            <button id="createBackupBtn" class="btn-info">
                <i class="fas fa-save"></i>
                创建备份
            </button>
            <button id="archiveAndClearBtn" class="btn-warning">
                <i class="fas fa-archive"></i>
                归档并清空
            </button>
            <button id="generateWinnersBtn" class="btn-success">
                <i class="fas fa-trophy"></i>
                生成获奖名单
            </button>
            <button id="clearDataBtn" class="btn-danger">
                <i class="fas fa-trash-alt"></i>
                清空数据
            </button>
            <button id="databaseInfoBtn" class="btn-secondary">
                <i class="fas fa-info-circle"></i>
                数据库信息
            </button>
        </div>
    `;
    
    // 设置按钮事件
    setupDashboardActions();
    
    // 加载数据
    await loadDashboardData();
}

async function loadParticipants() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="participants-management">
            <div class="management-header">
                <div class="header-left">
                    <h3 class="section-title"><i class="fas fa-users"></i> 参与者管理</h3>
                    <p class="section-subtitle">管理所有参与者信息，支持编辑和删除操作</p>
                </div>
                <div class="header-actions">
                    <button id="addParticipantBtn" class="btn-primary">
                        <i class="fas fa-plus"></i>
                        添加参与者
                    </button>
                    <button id="refreshParticipantsBtn" class="btn-secondary">
                        <i class="fas fa-sync-alt"></i>
                        刷新数据
                    </button>
                </div>
            </div>
            
            <div class="management-filters">
                <div class="filter-group">
                    <label for="searchInput">搜索参与者：</label>
                    <input type="text" id="searchInput" class="search-input" placeholder="输入姓名或数字ID搜索...">
                </div>
                <div class="filter-group">
                    <label for="genderFilter">性别筛选：</label>
                    <select id="genderFilter" class="filter-select">
                        <option value="">所有性别</option>
                        <option value="male">男士</option>
                        <option value="female">女士</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="sortBy">排序方式：</label>
                    <select id="sortBy" class="filter-select">
                        <option value="voteCount">按得票数</option>
                        <option value="name">按姓名</option>
                        <option value="createdAt">按注册时间</option>
                    </select>
                </div>
            </div>
            
            <div class="participants-stats">
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h4>总参与者</h4>
                        <span id="totalParticipantsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-mars"></i>
                    </div>
                    <div class="stat-info">
                        <h4>男性参与者</h4>
                        <span id="maleParticipantsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon pink">
                        <i class="fas fa-venus"></i>
                    </div>
                    <div class="stat-info">
                        <h4>女性参与者</h4>
                        <span id="femaleParticipantsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">
                        <i class="fas fa-vote-yea"></i>
                    </div>
                    <div class="stat-info">
                        <h4>总投票数</h4>
                        <span id="totalVotesCount">0</span>
                    </div>
                </div>
            </div>
            
            <div class="participants-table-container">
                <table class="participants-table">
                    <thead>
                        <tr>
                            <th>头像</th>
                            <th>姓名</th>
                            <th>性别</th>
                            <th>数字ID</th>
                            <th>得票数</th>
                            <th>注册时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="participantsTableBody">
                        <tr>
                            <td colspan="7" class="loading">
                                <i class="fas fa-spinner fa-spin"></i>
                                加载中...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="table-pagination" id="tablePagination">
                <!-- 分页控件将通过JavaScript生成 -->
            </div>
        </div>
    `;
    
    await loadParticipantsData();
    setupParticipantsManagement();
}

async function loadVotingStats() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="card-header">
                    <h3 class="card-title">投票进度</h3>
                    <div class="card-icon votes">
                        <i class="fas fa-vote-yea"></i>
                    </div>
                </div>
                <div id="votingProgress">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        加载中...
                    </div>
                </div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-header">
                    <h3 class="card-title">投票分布</h3>
                    <div class="card-icon stats">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                </div>
                <div id="voteDistribution">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        加载中...
                    </div>
                </div>
            </div>
        </div>
        
        <div class="recent-activity">
            <h2><i class="fas fa-history"></i> 投票历史</h2>
            <div id="votingHistory" class="activity-list">
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    加载中...
                </div>
            </div>
        </div>
    `;
    
    await loadVotingStatsData();
}

async function loadWinners() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="winners-section">
            <div class="card-header">
                <h2 class="card-title"><i class="fas fa-trophy"></i> 获奖名单</h2>
                <button id="generateWinnersBtn" class="btn-primary">
                    <i class="fas fa-magic"></i>
                    生成获奖名单
                </button>
            </div>
            <div id="winnersList" class="winners-display">
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    加载中...
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('generateWinnersBtn').addEventListener('click', generateWinnersList);
    await loadWinnersData();
}

async function loadSettings() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <div class="card-header">
                    <h3 class="card-title">系统操作</h3>
                    <div class="card-icon settings">
                        <i class="fas fa-cog"></i>
                    </div>
                </div>
                <div class="admin-actions">
                    <button id="exportResultsBtn" class="btn-primary">
                        <i class="fas fa-download"></i>
                        导出所有数据
                    </button>
                    <button id="clearDataBtn" class="btn-danger">
                        <i class="fas fa-trash-alt"></i>
                        清空所有数据
                    </button>
                    <a href="/ranking-display" class="btn-secondary" target="_blank">
                        <i class="fas fa-external-link-alt"></i>
                        大屏展示
                    </a>
                    <a href="/" class="btn-secondary" target="_blank">
                        <i class="fas fa-home"></i>
                        返回首页
                    </a>
                </div>
            </div>
            
            <div class="dashboard-card">
                <div class="card-header">
                    <h3 class="card-title">系统信息</h3>
                    <div class="card-icon stats">
                        <i class="fas fa-info-circle"></i>
                    </div>
                </div>
                <div id="systemInfo">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        加载中...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupSettingsActions();
    await loadSystemInfo();
}

function setupDashboardActions() {
    const exportBtn = document.getElementById('exportResultsBtn');
    const createBackupBtn = document.getElementById('createBackupBtn');
    const archiveAndClearBtn = document.getElementById('archiveAndClearBtn');
    const winnersBtn = document.getElementById('generateWinnersBtn');
    const clearBtn = document.getElementById('clearDataBtn');
    const databaseInfoBtn = document.getElementById('databaseInfoBtn');
    
    if (exportBtn) exportBtn.addEventListener('click', exportResults);
    if (createBackupBtn) createBackupBtn.addEventListener('click', createDataBackup);
    if (archiveAndClearBtn) archiveAndClearBtn.addEventListener('click', confirmArchiveAndClear);
    if (winnersBtn) winnersBtn.addEventListener('click', generateWinnersList);
    if (clearBtn) clearBtn.addEventListener('click', confirmClearData);
    if (databaseInfoBtn) databaseInfoBtn.addEventListener('click', showDatabaseInfo);
}

function setupSettingsActions() {
    const exportBtn = document.getElementById('exportResultsBtn');
    const clearBtn = document.getElementById('clearDataBtn');
    
    if (exportBtn) exportBtn.addEventListener('click', exportResults);
    if (clearBtn) clearBtn.addEventListener('click', confirmClearData);
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showLoginForm();
                return;
            }
            throw new Error('Failed to load dashboard data');
        }
        
        const result = await response.json();
        
        if (result.success) {
            updateStatsDisplay(result.dashboard.statistics);
            updateHeaderStats(result.dashboard.statistics);
            updateRankingDisplay(result.dashboard.ranking);
            updateRecentActivity(result.dashboard.recentActivity);
        }
        
    } catch (error) {
        console.error('Load dashboard data error:', error);
        showError('加载数据失败，请刷新页面重试');
    }
}

async function loadParticipantsData() {
    try {
        const response = await fetch('/api/admin/users?limit=1000', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showLoginForm();
                return;
            }
            throw new Error('Failed to load participants data');
        }
        
        const result = await response.json();
        if (result.success) {
            updateParticipantsTable(result.users || []);
            updateParticipantsStats(result.users || []);
        }
        
    } catch (error) {
        console.error('Load participants data error:', error);
        showError('加载参与者数据失败');
    }
}

function updateParticipantsStats(participants) {
    const totalCount = participants.length;
    const maleCount = participants.filter(p => p.gender === 'male').length;
    const femaleCount = participants.filter(p => p.gender === 'female').length;
    const totalVotes = participants.reduce((sum, p) => sum + (p.voteCount || 0), 0);
    
    const elements = {
        totalParticipantsCount: totalCount,
        maleParticipantsCount: maleCount,
        femaleParticipantsCount: femaleCount,
        totalVotesCount: totalVotes
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

async function loadVotingStatsData() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load voting stats');
        
        const result = await response.json();
        if (result.success) {
            updateVotingProgress(result.dashboard.votingProgress || {});
            updateVoteDistribution(result.dashboard.statistics || {});
            updateVotingHistory(result.dashboard.recentActivity || []);
        }
        
    } catch (error) {
        console.error('Load voting stats error:', error);
        showError('加载投票统计失败');
    }
}

async function loadWinnersData() {
    try {
        const response = await fetch('/api/admin/winners', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayWinners(result.winners);
        } else {
            document.getElementById('winnersList').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <p>暂未生成获奖名单，请点击上方按钮生成</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load winners error:', error);
        showError('加载获奖名单失败');
    }
}

async function loadSystemInfo() {
    const systemInfo = document.getElementById('systemInfo');
    const now = new Date();
    
    systemInfo.innerHTML = `
        <div style="padding: 16px;">
            <div style="margin-bottom: 12px;">
                <strong>系统时间：</strong> ${now.toLocaleString('zh-CN')}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>管理员：</strong> 已登录
            </div>
            <div style="margin-bottom: 12px;">
                <strong>自动刷新：</strong> ${refreshInterval ? '已启用' : '已禁用'}
            </div>
            <div>
                <strong>版本：</strong> v1.0.0
            </div>
        </div>
    `;
}

function updateStatsDisplay(stats) {
    const elements = {
        totalParticipants: stats.totalParticipants || 0,
        totalVotes: stats.totalVotes || 0,
        maleParticipants: stats.maleParticipants || 0,
        femaleParticipants: stats.femaleParticipants || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            animateNumber(element, parseInt(element.textContent) || 0, value);
        }
    });
}

function updateHeaderStats(stats) {
    const headerTotalUsers = document.getElementById('headerTotalUsers');
    const headerTotalVotes = document.getElementById('headerTotalVotes');
    
    if (headerTotalUsers) headerTotalUsers.textContent = stats.totalParticipants || 0;
    if (headerTotalVotes) headerTotalVotes.textContent = stats.totalVotes || 0;
}

function animateNumber(element, start, end) {
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateRankingDisplay(ranking) {
    updateGenderRanking('maleRanking', ranking.male || [], 'male');
    updateGenderRanking('femaleRanking', ranking.female || [], 'female');
}

function updateGenderRanking(containerId, participants, gender) {
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    if (participants.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>暂无参与者</p>
            </div>
        `;
        return;
    }
    
    // 只显示前三名
    const topThree = participants.slice(0, 3);
    
    container.innerHTML = topThree.map((participant, index) => {
        const rankClass = ['first', 'second', 'third'][index] || '';
        const prizes = ['🥇 一等奖', '🥈 二等奖', '🥉 三等奖'];
        
        return `
            <div class="ranking-item ${rankClass}">
                <span class="ranking-number">${index + 1}</span>
                <img src="${participant.avatarUrl || getDefaultAvatar(gender)}" 
                     alt="${participant.name}" class="ranking-avatar"
                     onerror="this.src='${getDefaultAvatar(gender)}'">
                <div class="ranking-info">
                    <div class="ranking-name">${participant.name}</div>
                    <div class="ranking-votes">${participant.voteCount || 0} 票</div>
                    <div class="ranking-prize">${prizes[index]}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateParticipantsTable(participants) {
    const tbody = document.getElementById('participantsTableBody');
    
    if (!tbody) return;
    
    if (participants.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>暂无参与者数据</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = participants.map(participant => `
        <tr data-user-id="${participant.id}">
            <td>
                <div class="participant-avatar">
                    <img src="${participant.avatarUrl || (participant.gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg')}" 
                         alt="${participant.name}" 
                         onerror="this.src='${participant.gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg'}'">
                </div>
            </td>
            <td>
                <div class="participant-name">
                    <strong>${participant.name}</strong>
                    ${participant.numericId ? `<small>ID: ${participant.numericId}</small>` : ''}
                </div>
            </td>
            <td>
                <span class="gender-badge ${participant.gender}">
                    <i class="fas fa-${participant.gender === 'male' ? 'mars' : 'venus'}"></i>
                    ${participant.gender === 'male' ? '男士' : '女士'}
                </span>
            </td>
            <td>
                <code class="numeric-id">${participant.numericId || 'N/A'}</code>
            </td>
            <td>
                <div class="vote-count">
                    <span class="count">${participant.voteCount || 0}</span>
                    <small>票</small>
                </div>
            </td>
            <td>
                <div class="created-time">
                    ${new Date(participant.createdAt).toLocaleString('zh-CN')}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editParticipant('${participant.id}')" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-view" onclick="viewParticipantDetails('${participant.id}')" title="查看详情">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteParticipant('${participant.id}', '${participant.name}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setupParticipantsManagement() {
    const searchInput = document.getElementById('searchInput');
    const genderFilter = document.getElementById('genderFilter');
    const sortBy = document.getElementById('sortBy');
    const addBtn = document.getElementById('addParticipantBtn');
    const refreshBtn = document.getElementById('refreshParticipantsBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterParticipants);
    }
    
    if (genderFilter) {
        genderFilter.addEventListener('change', filterParticipants);
    }
    
    if (sortBy) {
        sortBy.addEventListener('change', sortParticipants);
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', showAddParticipantModal);
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadParticipantsData);
    }
}

function filterParticipants() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const genderFilter = document.getElementById('genderFilter').value;
    const rows = document.querySelectorAll('#participantsTableBody tr');
    
    rows.forEach(row => {
        const name = row.querySelector('.user-name')?.textContent.toLowerCase() || '';
        const gender = row.querySelector('.gender-badge')?.classList.contains('male') ? 'male' : 'female';
        
        const matchesSearch = name.includes(searchTerm);
        const matchesGender = !genderFilter || gender === genderFilter;
        
        row.style.display = matchesSearch && matchesGender ? '' : 'none';
    });
}

function updateVotingProgress(progress) {
    const container = document.getElementById('votingProgress');
    if (!container) return;
    
    container.innerHTML = `
        <div style="padding: 16px;">
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>活跃投票者</span>
                    <span><strong>${progress.activeVoters || 0}</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>男士投票数</span>
                    <span><strong>${progress.maleVotesCast || 0}</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>女士投票数</span>
                    <span><strong>${progress.femaleVotesCast || 0}</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>完成投票者</span>
                    <span><strong>${progress.completedVoters || 0}</strong></span>
                </div>
            </div>
            <div style="background: #f0f0f0; border-radius: 8px; height: 8px; overflow: hidden;">
                <div style="background: #3498db; height: 100%; width: ${progress.votingCompletionRate || 0}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="text-align: center; margin-top: 8px; font-size: 14px; color: #666;">
                完成率: ${progress.votingCompletionRate || 0}%
            </div>
        </div>
    `;
}

function updateVoteDistribution(stats) {
    const container = document.getElementById('voteDistribution');
    if (!container) return;
    
    const total = (stats.maleVotes || 0) + (stats.femaleVotes || 0);
    const malePercent = total > 0 ? ((stats.maleVotes || 0) / total * 100).toFixed(1) : 0;
    const femalePercent = total > 0 ? ((stats.femaleVotes || 0) / total * 100).toFixed(1) : 0;
    
    container.innerHTML = `
        <div style="padding: 16px;">
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span><i class="fas fa-mars" style="color: #3498db;"></i> 男士得票</span>
                    <span><strong>${stats.maleVotes || 0}</strong> (${malePercent}%)</span>
                </div>
                <div style="background: #f0f0f0; border-radius: 4px; height: 6px; overflow: hidden; margin-bottom: 12px;">
                    <div style="background: #3498db; height: 100%; width: ${malePercent}%; transition: width 0.3s ease;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span><i class="fas fa-venus" style="color: #e91e63;"></i> 女士得票</span>
                    <span><strong>${stats.femaleVotes || 0}</strong> (${femalePercent}%)</span>
                </div>
                <div style="background: #f0f0f0; border-radius: 4px; height: 6px; overflow: hidden;">
                    <div style="background: #e91e63; height: 100%; width: ${femalePercent}%; transition: width 0.3s ease;"></div>
                </div>
            </div>
        </div>
    `;
}

function updateVotingHistory(activities) {
    const container = document.getElementById('votingHistory');
    if (!container) return;
    
    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>暂无投票历史</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.slice(0, 20).map(activity => {
        const timeAgo = getTimeAgo(activity.voteTime);
        
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-vote-yea"></i>
                </div>
                <div class="activity-info">
                    <div class="activity-text">
                        ${activity.targetName} 获得一票
                        ${activity.voterName ? `(来自 ${activity.voterName})` : '(匿名投票)'}
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    
    if (!container) return;
    
    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <p>暂无最近活动</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.slice(0, 10).map(activity => {
        const timeAgo = getTimeAgo(activity.voteTime);
        
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-vote-yea"></i>
                </div>
                <div class="activity-info">
                    <div class="activity-text">
                        ${activity.targetName} 获得一票
                        ${activity.voterName ? `(来自 ${activity.voterName})` : '(匿名投票)'}
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
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

function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('admin_token');
        adminToken = null;
        stopAutoRefresh();
        showSuccess('已退出登录');
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

async function generateWinnersList() {
    const btn = document.getElementById('generateWinnersBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
    
    try {
        const response = await fetch('/api/admin/winners', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayWinners(result.winners);
            showSuccess('获奖名单生成成功');
        } else {
            showError(result.message || '生成获奖名单失败');
        }
    } catch (error) {
        console.error('Generate winners error:', error);
        showError('生成获奖名单失败');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function displayWinners(winners) {
    const container = document.getElementById('winnersList');
    
    if (!container) return;
    
    const maleWinners = winners.male || [];
    const femaleWinners = winners.female || [];
    
    container.innerHTML = `
        <div class="winners-group">
            <h3><i class="fas fa-mars"></i> 男士组获奖者</h3>
            ${maleWinners.length > 0 ? maleWinners.map((winner, index) => `
                <div class="winner-item ${['first', 'second', 'third'][index] || ''}">
                    <span class="winner-rank">${winner.prize}</span>
                    <span class="winner-name">${winner.name}</span>
                    <span class="winner-votes">${winner.voteCount} 票</span>
                </div>
            `).join('') : '<div class="empty-state"><i class="fas fa-trophy"></i><p>暂无获奖者</p></div>'}
        </div>
        
        <div class="winners-group">
            <h3><i class="fas fa-venus"></i> 女士组获奖者</h3>
            ${femaleWinners.length > 0 ? femaleWinners.map((winner, index) => `
                <div class="winner-item ${['first', 'second', 'third'][index] || ''}">
                    <span class="winner-rank">${winner.prize}</span>
                    <span class="winner-name">${winner.name}</span>
                    <span class="winner-votes">${winner.voteCount} 票</span>
                </div>
            `).join('') : '<div class="empty-state"><i class="fas fa-trophy"></i><p>暂无获奖者</p></div>'}
        </div>
    `;
}

async function exportResults() {
    const btn = document.getElementById('exportResultsBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导出中...';
    
    try {
        const response = await fetch('/api/admin/export', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voting-results-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showSuccess('结果导出成功');
        } else {
            showError('导出失败，请重试');
        }
    } catch (error) {
        console.error('Export error:', error);
        showError('导出失败，请检查网络连接');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function confirmClearData() {
    if (confirm('⚠️ 危险操作警告\n\n确定要清空所有投票数据吗？此操作不可恢复！\n\n这将删除：\n• 所有用户账号\n• 所有投票记录\n• 所有统计数据\n\n请再次确认您要执行此操作。')) {
        if (confirm('最后确认：您真的要清空所有数据吗？\n\n此操作将立即生效且无法撤销！')) {
            clearAllData();
        }
    }
}

async function clearAllData() {
    const btn = document.getElementById('clearDataBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 清空中...';
    
    try {
        const response = await fetch('/api/admin/clear-data', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('数据清空成功，正在刷新页面...');
            setTimeout(() => {
                loadCurrentSectionData();
            }, 1500);
        } else {
            showError(result.message || '数据清空失败');
        }
    } catch (error) {
        console.error('Clear data error:', error);
        showError('操作失败，请重试');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function startAutoRefresh() {
    // 每30秒自动刷新数据
    refreshInterval = setInterval(() => {
        if (currentSection === 'dashboard') {
            loadDashboardData();
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showInfo(message) {
    showMessage(message, 'info');
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
    
    const icon = type === 'error' ? 'fas fa-exclamation-circle' : 
                 type === 'success' ? 'fas fa-check-circle' : 'fas fa-info-circle';
    
    messageDiv.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    // 插入到页面顶部
    const adminContent = document.getElementById('adminContent');
    adminContent.insertBefore(messageDiv, adminContent.firstChild);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// ==================== 数据管理功能 ====================

async function createDataBackup() {
    const btn = document.getElementById('createBackupBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
    
    try {
        const response = await fetch('/api/admin/backup', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (response.ok) {
            // 触发文件下载
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voting-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showSuccess('数据备份已创建并下载');
        } else {
            const result = await response.json();
            showError(result.message || '创建备份失败');
        }
    } catch (error) {
        console.error('Create backup error:', error);
        showError('操作失败，请重试');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function confirmArchiveAndClear() {
    if (confirm('📦 数据归档和清空确认\n\n此操作将：\n• 创建完整的数据备份\n• 备份所有头像文件\n• 清空数据库中的所有数据\n• 清理上传的头像文件\n\n备份文件将自动下载到您的电脑。\n\n确定要继续吗？')) {
        if (confirm('⚠️ 最后确认\n\n数据清空后无法恢复，只能通过备份文件还原。\n\n确定要执行归档和清空操作吗？')) {
            archiveAndClearData();
        }
    }
}

async function archiveAndClearData() {
    const btn = document.getElementById('archiveAndClearBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 归档中...';
    
    try {
        const response = await fetch('/api/admin/archive-and-clear', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ includeFiles: true })
        });
        
        if (response.ok) {
            // 触发文件下载
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voting-archive-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showSuccess('数据已成功归档并清空，归档文件已下载');
            
            // 刷新页面数据
            setTimeout(() => {
                loadCurrentSectionData();
            }, 2000);
        } else {
            const result = await response.json();
            showError(result.message || '归档和清空失败');
        }
    } catch (error) {
        console.error('Archive and clear error:', error);
        showError('操作失败，请重试');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function showDatabaseInfo() {
    const btn = document.getElementById('databaseInfoBtn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 获取中...';
    
    try {
        const response = await fetch('/api/admin/database-info', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const info = result.databaseInfo;
            
            const infoHtml = `
                <div class="database-info-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3><i class="fas fa-database"></i> 数据库信息</h3>
                            <button class="close-btn" onclick="closeDatabaseInfoModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="info-section">
                                <h4><i class="fas fa-server"></i> 数据库文件</h4>
                                <p><strong>文件路径:</strong> ${info.database.filePath}</p>
                                <p><strong>文件存在:</strong> ${info.database.fileExists ? '是' : '否'}</p>
                                <p><strong>文件大小:</strong> ${info.database.fileSizeFormatted}</p>
                            </div>
                            
                            <div class="info-section">
                                <h4><i class="fas fa-folder"></i> 上传目录</h4>
                                <p><strong>目录路径:</strong> ${info.uploads.path}</p>
                                <p><strong>目录存在:</strong> ${info.uploads.exists ? '是' : '否'}</p>
                                <p><strong>图片文件数:</strong> ${info.uploads.totalFiles}</p>
                                <p><strong>总大小:</strong> ${info.uploads.totalSizeFormatted}</p>
                            </div>
                            
                            <div class="info-section">
                                <h4><i class="fas fa-chart-bar"></i> 数据统计</h4>
                                <p><strong>总用户数:</strong> ${info.dataInfo.totalUsers}</p>
                                <p><strong>总投票数:</strong> ${info.dataInfo.totalVotes}</p>
                                <p><strong>参与者总数:</strong> ${info.dataInfo.totalParticipants}</p>
                                <p><strong>男性参与者:</strong> ${info.dataInfo.maleParticipants}</p>
                                <p><strong>女性参与者:</strong> ${info.dataInfo.femaleParticipants}</p>
                            </div>
                            
                            <div class="info-section">
                                <h4><i class="fas fa-clock"></i> 更新时间</h4>
                                <p>${new Date(info.lastUpdated).toLocaleString('zh-CN')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加模态框到页面
            const modalDiv = document.createElement('div');
            modalDiv.innerHTML = infoHtml;
            document.body.appendChild(modalDiv);
            
        } else {
            showError(result.message || '获取数据库信息失败');
        }
    } catch (error) {
        console.error('Get database info error:', error);
        showError('操作失败，请重试');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function closeDatabaseInfoModal() {
    const modal = document.querySelector('.database-info-modal');
    if (modal) {
        modal.remove();
    }
}

// 点击模态框外部关闭
document.addEventListener('click', function(event) {
    const modal = document.querySelector('.database-info-modal');
    if (modal && event.target === modal) {
        closeDatabaseInfoModal();
    }
});
// ==================== 参与者管理功能 ====================

function sortParticipants() {
    const sortBy = document.getElementById('sortBy').value;
    const rows = Array.from(document.querySelectorAll('#participantsTableBody tr[data-user-id]'));
    
    rows.sort((a, b) => {
        const aData = getRowData(a);
        const bData = getRowData(b);
        
        switch (sortBy) {
            case 'voteCount':
                return (bData.voteCount || 0) - (aData.voteCount || 0);
            case 'name':
                return aData.name.localeCompare(bData.name);
            case 'createdAt':
                return new Date(bData.createdAt) - new Date(aData.createdAt);
            default:
                return 0;
        }
    });
    
    const tbody = document.getElementById('participantsTableBody');
    rows.forEach(row => tbody.appendChild(row));
}

function getRowData(row) {
    const nameElement = row.querySelector('.participant-name strong');
    const voteElement = row.querySelector('.vote-count .count');
    const timeElement = row.querySelector('.created-time');
    
    return {
        name: nameElement ? nameElement.textContent : '',
        voteCount: voteElement ? parseInt(voteElement.textContent) : 0,
        createdAt: timeElement ? timeElement.textContent : ''
    };
}

function showAddParticipantModal() {
    const modalHtml = `
        <div class="participant-modal" id="participantModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> 添加参与者</h3>
                    <button class="close-btn" onclick="closeParticipantModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="participantForm">
                        <div class="form-group">
                            <label for="participantName">姓名 *</label>
                            <input type="text" id="participantName" name="name" required 
                                   placeholder="请输入参与者姓名" maxlength="20">
                        </div>
                        
                        <div class="form-group">
                            <label for="participantGender">性别 *</label>
                            <select id="participantGender" name="gender" required>
                                <option value="">请选择性别</option>
                                <option value="male">男士</option>
                                <option value="female">女士</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="participantAvatar">头像</label>
                            <input type="file" id="participantAvatar" name="avatar" 
                                   accept="image/jpeg,image/png" class="file-input">
                            <small class="form-help">支持JPG、PNG格式，最大2MB</small>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeParticipantModal()">
                                取消
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i>
                                保存
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 设置表单提交事件
    const form = document.getElementById('participantForm');
    form.addEventListener('submit', handleAddParticipant);
}

function editParticipant(userId) {
    // 获取用户数据
    fetch(`/api/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showEditParticipantModal(result.user);
        } else {
            showError('获取用户信息失败');
        }
    })
    .catch(error => {
        console.error('Get user error:', error);
        showError('获取用户信息失败');
    });
}

function showEditParticipantModal(user) {
    const modalHtml = `
        <div class="participant-modal" id="participantModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-edit"></i> 编辑参与者</h3>
                    <button class="close-btn" onclick="closeParticipantModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="participantForm">
                        <input type="hidden" id="participantId" value="${user.id}">
                        
                        <div class="form-group">
                            <label for="participantName">姓名 *</label>
                            <input type="text" id="participantName" name="name" required 
                                   value="${user.name}" placeholder="请输入参与者姓名" maxlength="20">
                        </div>
                        
                        <div class="form-group">
                            <label for="participantGender">性别 *</label>
                            <select id="participantGender" name="gender" required disabled>
                                <option value="male" ${user.gender === 'male' ? 'selected' : ''}>男士</option>
                                <option value="female" ${user.gender === 'female' ? 'selected' : ''}>女士</option>
                            </select>
                            <small class="form-help">性别不可修改</small>
                        </div>
                        
                        <div class="form-group">
                            <label>当前头像</label>
                            <div class="current-avatar">
                                <img src="${user.avatarUrl || (user.gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg')}" 
                                     alt="${user.name}" class="avatar-preview">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="participantAvatar">更换头像</label>
                            <input type="file" id="participantAvatar" name="avatar" 
                                   accept="image/jpeg,image/png" class="file-input">
                            <small class="form-help">支持JPG、PNG格式，最大2MB</small>
                        </div>
                        
                        <div class="form-group">
                            <label>统计信息</label>
                            <div class="user-stats">
                                <div class="stat-item">
                                    <span class="label">数字ID:</span>
                                    <span class="value">${user.numericId || 'N/A'}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="label">得票数:</span>
                                    <span class="value">${user.voteCount || 0} 票</span>
                                </div>
                                <div class="stat-item">
                                    <span class="label">注册时间:</span>
                                    <span class="value">${new Date(user.createdAt).toLocaleString('zh-CN')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeParticipantModal()">
                                取消
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i>
                                保存修改
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 设置表单提交事件
    const form = document.getElementById('participantForm');
    form.addEventListener('submit', handleEditParticipant);
}

function viewParticipantDetails(userId) {
    // 获取用户详细信息
    fetch(`/api/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showParticipantDetailsModal(result.user);
        } else {
            showError('获取用户信息失败');
        }
    })
    .catch(error => {
        console.error('Get user error:', error);
        showError('获取用户信息失败');
    });
}

function showParticipantDetailsModal(user) {
    const modalHtml = `
        <div class="participant-modal" id="participantModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user"></i> 参与者详情</h3>
                    <button class="close-btn" onclick="closeParticipantModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="participant-details">
                        <div class="detail-section">
                            <div class="user-profile">
                                <div class="profile-avatar">
                                    <img src="${user.avatarUrl || (user.gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg')}" 
                                         alt="${user.name}">
                                </div>
                                <div class="profile-info">
                                    <h4>${user.name}</h4>
                                    <p class="gender-info">
                                        <i class="fas fa-${user.gender === 'male' ? 'mars' : 'venus'}"></i>
                                        ${user.gender === 'male' ? '男士' : '女士'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h5><i class="fas fa-info-circle"></i> 基本信息</h5>
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="label">用户ID:</span>
                                    <span class="value">${user.id}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">数字ID:</span>
                                    <span class="value">${user.numericId || 'N/A'}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">注册时间:</span>
                                    <span class="value">${new Date(user.createdAt).toLocaleString('zh-CN')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">最后更新:</span>
                                    <span class="value">${new Date(user.updatedAt).toLocaleString('zh-CN')}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h5><i class="fas fa-chart-bar"></i> 投票统计</h5>
                            <div class="vote-stats">
                                <div class="stat-card">
                                    <div class="stat-number">${user.voteCount || 0}</div>
                                    <div class="stat-label">获得票数</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h5><i class="fas fa-qrcode"></i> 二维码</h5>
                            <div class="qr-code-section">
                                ${user.qrCode ? `
                                    <div class="qr-code-display">
                                        <img src="${user.qrCode}" alt="二维码" class="qr-code-image">
                                        <p>扫描此二维码为该参与者投票</p>
                                    </div>
                                ` : '<p class="no-qr">暂无二维码</p>'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="editParticipant('${user.id}')">
                            <i class="fas fa-edit"></i>
                            编辑信息
                        </button>
                        <button class="btn-secondary" onclick="closeParticipantModal()">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function deleteParticipant(userId, userName) {
    if (confirm(`⚠️ 删除参与者确认\n\n确定要删除参与者 "${userName}" 吗？\n\n此操作将：\n• 删除该参与者的所有信息\n• 删除相关的投票记录\n• 删除相关的投票限制\n\n此操作不可恢复！`)) {
        const btn = event.target.closest('.btn-delete');
        const originalHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showSuccess(`参与者 "${userName}" 已删除`);
                loadParticipantsData(); // 重新加载数据
            } else {
                showError(result.message || '删除失败');
            }
        })
        .catch(error => {
            console.error('Delete participant error:', error);
            showError('删除失败，请重试');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
    }
}

async function handleAddParticipant(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    
    try {
        // 先创建用户
        const userData = {
            name: formData.get('name'),
            gender: formData.get('gender')
        };
        
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 如果有头像文件，上传头像
            const avatarFile = formData.get('avatar');
            if (avatarFile && avatarFile.size > 0) {
                const avatarFormData = new FormData();
                avatarFormData.append('avatar', avatarFile);
                avatarFormData.append('userId', result.user.id);
                
                await fetch('/api/users/upload-avatar', {
                    method: 'POST',
                    body: avatarFormData
                });
            }
            
            showSuccess('参与者添加成功');
            closeParticipantModal();
            loadParticipantsData();
        } else {
            showError(result.message || '添加失败');
        }
    } catch (error) {
        console.error('Add participant error:', error);
        showError('添加失败，请重试');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function handleEditParticipant(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const userId = document.getElementById('participantId').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    
    try {
        // 更新用户基本信息
        const userData = {
            name: formData.get('name')
        };
        
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 如果有新头像文件，上传头像
            const avatarFile = formData.get('avatar');
            if (avatarFile && avatarFile.size > 0) {
                const avatarFormData = new FormData();
                avatarFormData.append('avatar', avatarFile);
                avatarFormData.append('userId', userId);
                
                await fetch('/api/users/upload-avatar', {
                    method: 'POST',
                    body: avatarFormData
                });
            }
            
            showSuccess('参与者信息更新成功');
            closeParticipantModal();
            loadParticipantsData();
        } else {
            showError(result.message || '更新失败');
        }
    } catch (error) {
        console.error('Edit participant error:', error);
        showError('更新失败，请重试');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function closeParticipantModal() {
    const modal = document.getElementById('participantModal');
    if (modal) {
        modal.remove();
    }
}

// 点击模态框外部关闭
document.addEventListener('click', function(event) {
    const modal = document.querySelector('.participant-modal');
    if (modal && event.target === modal) {
        closeParticipantModal();
    }
});