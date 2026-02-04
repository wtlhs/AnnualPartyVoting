// 管理后台页面 JavaScript - PC端优化版本
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

let currentSection = 'dashboard';
let refreshInterval = null;
let adminToken = null; // 管理员认证令牌

// 使用统一的认证管理器
const auth = window.adminAuth;

// 全局API调用包装器，使用认证管理器
async function apiCall(url, options = {}) {
    return await auth.apiCall(url, options);
}

// 获取当前认证令牌
function getAdminToken() {
    if (!adminToken) {
        adminToken = auth.getToken();
    }
    return adminToken;
}

function initializeAdmin() {
    // 检查认证状态，但不自动重定向
    if (!auth.isAuthenticated(false)) {
        // 认证失败，显示登录表单
        showLoginForm();
        return;
    }
    
    // 设置管理员令牌
    adminToken = auth.getToken();
    
    // 认证成功，启动会话监控
    auth.startSessionMonitoring();
    
    // 显示管理界面
    showAdminInterface();
    setupEventListeners();
    loadCurrentSectionData();
    startAutoRefresh();
}

function setupEventListeners() {
    // 侧边栏切换
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // 遮罩层点击关闭侧边栏
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // 点击导航项后关闭移动端侧边栏
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

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
    const overlay = document.getElementById('sidebarOverlay');

    const isOpen = sidebar.classList.contains('show');

    if (isOpen) {
        closeSidebar();
    } else {
        sidebar.classList.add('show');
        main.classList.add('expanded');
        overlay.classList.add('show');
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const main = document.querySelector('.admin-main');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.remove('show');
    main.classList.remove('expanded');
    overlay.classList.remove('show');
    // 恢复背景滚动
    document.body.style.overflow = '';
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
    // 使用认证管理器检查认证状态
    if (!auth.isAuthenticated(false)) {
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
    // 使用认证管理器验证会话
    return await auth.validateSession();
}

function handleSessionExpired() {
    // 使用认证管理器处理会话过期
    auth.handleSessionExpired();
    stopAutoRefresh();
    setTimeout(() => {
        showLoginForm();
    }, 2000);
}

function scheduleSessionRefresh(remainingTime) {
    // 在会话过期前5分钟刷新会话
    const refreshTime = Math.max(remainingTime - 5 * 60 * 1000, 60 * 1000);
    
    setTimeout(() => {
        verifyToken();
    }, refreshTime);
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
            auth.setToken(result.token);
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
            case 'guests':
                await loadGuests();
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

async function loadGuests() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="participants-management">
            <div class="management-header">
                <div class="header-left">
                    <h3 class="section-title"><i class="fas fa-user-tie"></i> 嘉宾管理</h3>
                    <p class="section-subtitle">管理嘉宾信息，支持添加、编辑和删除操作</p>
                </div>
                <div class="header-actions">
                    <button id="addGuestBtn" class="btn-primary">
                        <i class="fas fa-plus"></i>
                        添加嘉宾
                    </button>
                    <button id="bulkImportGuestsBtn" class="btn-secondary">
                        <i class="fas fa-file-import"></i>
                        批量导入
                    </button>
                    <button id="refreshGuestsBtn" class="btn-secondary">
                        <i class="fas fa-sync-alt"></i>
                        刷新数据
                    </button>
                </div>
            </div>

            <div class="management-filters">
                <div class="filter-group">
                    <label for="guestSearchInput">搜索嘉宾：</label>
                    <input type="text" id="guestSearchInput" class="search-input" placeholder="输入姓名搜索...">
                </div>
                <div class="filter-group">
                    <label for="guestGenderFilter">性别筛选：</label>
                    <select id="guestGenderFilter" class="filter-select">
                        <option value="">所有性别</option>
                        <option value="male">男士</option>
                        <option value="female">女士</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="guestSourceFilter">来源筛选：</label>
                    <select id="guestSourceFilter" class="filter-select">
                        <option value="">所有来源</option>
                        <option value="admin">管理员添加</option>
                        <option value="self">自助注册</option>
                    </select>
                </div>
            </div>

            <div class="participants-stats">
                <div class="stat-card">
                    <div class="stat-icon purple">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div class="stat-info">
                        <h4>总嘉宾数</h4>
                        <span id="totalGuestsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-mars"></i>
                    </div>
                    <div class="stat-info">
                        <h4>男性嘉宾</h4>
                        <span id="maleGuestsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon pink">
                        <i class="fas fa-venus"></i>
                    </div>
                    <div class="stat-info">
                        <h4>女性嘉宾</h4>
                        <span id="femaleGuestsCount">0</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="stat-info">
                        <h4>自助注册</h4>
                        <span id="selfRegisteredCount">0</span>
                    </div>
                </div>
            </div>

            <div class="participants-table-container">
                <table class="participants-table">
                    <thead>
                        <tr>
                            <th>姓名</th>
                            <th>性别</th>
                            <th>来源</th>
                            <th>添加人</th>
                            <th>添加时间</th>
                            <th>备注</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="guestsTableBody">
                        <tr>
                            <td colspan="7" class="loading">
                                <i class="fas fa-spinner fa-spin"></i>
                                加载中...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    await loadGuestsData();
    setupGuestsManagement();
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
                    <h3 class="card-title">投票控制</h3>
                    <div class="card-icon settings">
                        <i class="fas fa-toggle-on"></i>
                    </div>
                </div>
                <div class="voting-controls">
                    <div class="control-section">
                        <div class="control-header">
                            <h4><i class="fas fa-power-off"></i> 投票开关</h4>
                            <div class="voting-status" id="votingStatusIndicator">
                                <div class="loading">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    加载中...
                                </div>
                            </div>
                        </div>
                        
                        <div class="control-actions">
                            <button id="toggleVotingBtn" class="btn-toggle" disabled>
                                <i class="fas fa-spinner fa-spin"></i>
                                加载中...
                            </button>
                            <button id="refreshStatusBtn" class="btn-secondary">
                                <i class="fas fa-sync-alt"></i>
                                刷新状态
                            </button>
                        </div>
                        
                        <div class="control-message">
                            <label for="votingMessage">投票关闭时的提示消息：</label>
                            <textarea id="votingMessage" class="message-input" 
                                      placeholder="请输入投票关闭时显示给用户的消息..." 
                                      maxlength="200" rows="3"></textarea>
                            <small class="form-help">最多200个字符</small>
                        </div>
                        
                        <div class="quick-actions">
                            <button id="enableVotingBtn" class="btn-success" disabled>
                                <i class="fas fa-play"></i>
                                开启投票
                            </button>
                            <button id="disableVotingBtn" class="btn-danger" disabled>
                                <i class="fas fa-stop"></i>
                                关闭投票
                            </button>
                        </div>
                    </div>
                    
                    <div class="control-section">
                        <h4><i class="fas fa-clock"></i> 时间控制（可选）</h4>
                        <div class="time-controls">
                            <div class="time-input-group">
                                <label for="votingStartTime">投票开始时间：</label>
                                <input type="datetime-local" id="votingStartTime" class="time-input">
                                <small class="form-help">留空表示不限制开始时间</small>
                            </div>
                            <div class="time-input-group">
                                <label for="votingEndTime">投票结束时间：</label>
                                <input type="datetime-local" id="votingEndTime" class="time-input">
                                <small class="form-help">留空表示不限制结束时间</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-section">
                        <h4><i class="fas fa-cog"></i> 高级设置</h4>
                        <div class="advanced-settings">
                            <div class="setting-item">
                                <label for="maxVotesPerUser">每用户最大投票数：</label>
                                <select id="maxVotesPerUser" class="setting-select">
                                    <option value="1">1票（只能投一个性别）</option>
                                    <option value="2">2票（男女各一票）</option>
                                    <option value="3">3票</option>
                                    <option value="4">4票</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="allowSelfVote">
                                    <span class="checkbox-text">允许为自己投票</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-actions-bottom">
                        <button id="saveSettingsBtn" class="btn-primary">
                            <i class="fas fa-save"></i>
                            保存所有设置
                        </button>
                        <button id="resetSettingsBtn" class="btn-warning">
                            <i class="fas fa-undo"></i>
                            重置为默认值
                        </button>
                    </div>
                </div>
            </div>
            
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
    setupVotingControls();
    await loadVotingSettings();
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
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

async function loadGuestsData() {
    try {
        const response = await fetch('/api/admin/guests', {
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showLoginForm();
                return;
            }
            throw new Error('Failed to load guests data');
        }

        const result = await response.json();
        if (result.success) {
            allGuests = result.guests || [];
            updateGuestsTable(allGuests);
            updateGuestsStats(allGuests);
        }

    } catch (error) {
        console.error('Load guests data error:', error);
        showError('加载嘉宾数据失败');
    }
}

function updateGuestsStats(guests) {
    const totalCount = guests.length;
    const maleCount = guests.filter(g => g.gender === 'male').length;
    const femaleCount = guests.filter(g => g.gender === 'female').length;
    const selfRegisteredCount = guests.filter(g => g.source === 'self').length;

    const elements = {
        totalGuestsCount: totalCount,
        maleGuestsCount: maleCount,
        femaleGuestsCount: femaleCount,
        selfRegisteredCount: selfRegisteredCount
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                    <button class="btn-view" style="background: #17a2b8;" onclick="viewParticipantVotes('${participant.id}', '${participant.name}')" title="查看投票">
                        <i class="fas fa-vote-yea"></i>
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

function updateGuestsTable(guests) {
    const tbody = document.getElementById('guestsTableBody');

    if (!tbody) return;

    if (guests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-user-tie"></i>
                    <p>暂无嘉宾数据</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = guests.map(guest => `
        <tr data-guest-id="${guest.id}">
            <td>
                <div class="participant-name">
                    <strong>${guest.name}</strong>
                </div>
            </td>
            <td>
                <span class="gender-badge ${guest.gender}">
                    <i class="fas fa-${guest.gender === 'male' ? 'mars' : 'venus'}"></i>
                    ${guest.gender === 'male' ? '男士' : '女士'}
                </span>
            </td>
            <td>
                <span class="source-badge ${guest.source}">
                    ${guest.source === 'admin' ? '管理员添加' : '自助注册'}
                </span>
            </td>
            <td>
                <small>${guest.addedBy || 'N/A'}</small>
            </td>
            <td>
                <div class="created-time">
                    ${new Date(guest.createdAt).toLocaleString('zh-CN')}
                </div>
            </td>
            <td>
                <small>${guest.notes || '-'}</small>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editGuest('${guest.id}')" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteGuest('${guest.id}', '${guest.name}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setupGuestsManagement() {
    const searchInput = document.getElementById('guestSearchInput');
    const genderFilter = document.getElementById('guestGenderFilter');
    const sourceFilter = document.getElementById('guestSourceFilter');
    const addBtn = document.getElementById('addGuestBtn');
    const bulkImportBtn = document.getElementById('bulkImportGuestsBtn');
    const refreshBtn = document.getElementById('refreshGuestsBtn');

    if (searchInput) {
        searchInput.addEventListener('input', filterGuests);
    }

    if (genderFilter) {
        genderFilter.addEventListener('change', filterGuests);
    }

    if (sourceFilter) {
        sourceFilter.addEventListener('change', filterGuests);
    }

    if (addBtn) {
        addBtn.addEventListener('click', showAddGuestModal);
    }

    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', showBulkImportGuestsModal);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadGuestsData);
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
    // 使用认证管理器处理登出
    auth.logout().then(() => {
        setTimeout(() => {
            location.reload();
        }, 1500);
    });
}

async function logoutFromServer() {
    // 这个函数现在由认证管理器的logout方法处理
    // 保留以保持兼容性
    return await auth.logout();
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
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
    auth.showMessage(message, 'error');
}

function showSuccess(message) {
    auth.showMessage(message, 'success');
}

function showInfo(message) {
    auth.showMessage(message, 'info');
}

function showMessage(message, type) {
    // 使用认证管理器的消息显示功能
    auth.showMessage(message, type);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// 点击弹窗背景关闭弹窗
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.remove();
    }
});

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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`,
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
                'Authorization': `Bearer ${getAdminToken()}`
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
            'Authorization': `Bearer ${getAdminToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('Edit participant API response:', result); // 调试日志

        if (result.success) {
            // API 返回的用户数据可能在 result.user 中,也可能直接在 result 中
            const userData = result.user || result;
            showEditParticipantModal(userData);
        } else {
            console.error('Invalid API response:', result);
            showError(result.message || '获取用户信息失败');
        }
    })
    .catch(error => {
        console.error('Get user error:', error);
        showError('获取用户信息失败: ' + error.message);
    });
}

function showEditParticipantModal(user) {
    // 验证用户数据
    if (!user || typeof user !== 'object') {
        console.error('Invalid user data:', user);
        showError('用户数据无效');
        return;
    }

    // 先移除已存在的 modal,避免叠加
    const existingModal = document.getElementById('participantModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 提供默认值,防止 undefined 错误
    const userData = {
        id: user.id || user.userId || 'N/A',
        name: user.name || '未知用户',
        gender: user.gender || 'male',
        avatarUrl: user.avatarUrl || user.avatar_url || null,
        numericId: user.numericId || user.numeric_id || 'N/A',
        createdAt: user.createdAt || user.created_at || new Date(),
        voteCount: user.voteCount || user.vote_count || 0
    };

    const defaultAvatar = userData.gender === 'male'
        ? '/static/images/default-male-avatar.svg'
        : '/static/images/default-female-avatar.svg';

    const modalHtml = `
        <div class="participant-modal" id="participantModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-edit"></i> 编辑参与者</h3>
                    <button class="close-btn" onclick="closeParticipantModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="participantForm">
                        <input type="hidden" id="participantId" value="${userData.id}">

                        <div class="form-group">
                            <label for="participantName">姓名 *</label>
                            <input type="text" id="participantName" name="name" required
                                   value="${userData.name}" placeholder="请输入参与者姓名" maxlength="20">
                        </div>

                        <div class="form-group">
                            <label for="participantGender">性别 *</label>
                            <select id="participantGender" name="gender" required disabled>
                                <option value="male" ${userData.gender === 'male' ? 'selected' : ''}>男士</option>
                                <option value="female" ${userData.gender === 'female' ? 'selected' : ''}>女士</option>
                            </select>
                            <small class="form-help">性别不可修改</small>
                        </div>

                        <div class="form-group">
                            <label>当前头像</label>
                            <div class="current-avatar">
                                <img src="${userData.avatarUrl || defaultAvatar}"
                                     alt="${userData.name}"
                                     onerror="this.src='${defaultAvatar}'"
                                     class="avatar-preview">
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
                                    <span class="value">${userData.numericId}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="label">得票数:</span>
                                    <span class="value">${userData.voteCount} 票</span>
                                </div>
                                <div class="stat-item">
                                    <span class="label">注册时间:</span>
                                    <span class="value">${new Date(userData.createdAt).toLocaleString('zh-CN')}</span>
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
            'Authorization': `Bearer ${getAdminToken()}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('Participant details API response:', result); // 调试日志

        if (result.success) {
            // API 返回的用户数据可能在 result.user 中,也可能直接在 result 中
            const userData = result.user || result;
            showParticipantDetailsModal(userData);
        } else {
            console.error('Invalid API response:', result);
            showError(result.message || '获取用户信息失败: 返回数据格式错误');
        }
    })
    .catch(error => {
        console.error('Get user error:', error);
        showError('获取用户信息失败: ' + error.message);
    });
}

function showParticipantDetailsModal(user) {
    // 验证用户数据
    if (!user || typeof user !== 'object') {
        console.error('Invalid user data:', user);
        showError('用户数据无效');
        return;
    }

    // 先移除已存在的 modal,避免叠加
    const existingModal = document.getElementById('participantModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 提供默认值,防止 undefined 错误
    const userData = {
        id: user.id || user.userId || 'N/A',
        name: user.name || '未知用户',
        gender: user.gender || 'male',
        avatarUrl: user.avatarUrl || user.avatar_url || null,
        numericId: user.numericId || user.numeric_id || 'N/A',
        createdAt: user.createdAt || user.created_at || new Date(),
        updatedAt: user.updatedAt || user.updated_at || new Date(),
        voteCount: user.voteCount || user.vote_count || 0,
        qrCode: user.qrCode || user.qr_code || null
    };

    const defaultAvatar = userData.gender === 'male'
        ? '/static/images/default-male-avatar.svg'
        : '/static/images/default-female-avatar.svg';

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
                                    <img src="${userData.avatarUrl || defaultAvatar}"
                                         alt="${userData.name}"
                                         onerror="this.src='${defaultAvatar}'">
                                </div>
                                <div class="profile-info">
                                    <h4>${userData.name}</h4>
                                    <p class="gender-info">
                                        <i class="fas fa-${userData.gender === 'male' ? 'mars' : 'venus'}"></i>
                                        ${userData.gender === 'male' ? '男士' : '女士'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h5><i class="fas fa-info-circle"></i> 基本信息</h5>
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="label">用户ID:</span>
                                    <span class="value">${userData.id}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">数字ID:</span>
                                    <span class="value">${userData.numericId}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">注册时间:</span>
                                    <span class="value">${new Date(userData.createdAt).toLocaleString('zh-CN')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">最后更新:</span>
                                    <span class="value">${new Date(userData.updatedAt).toLocaleString('zh-CN')}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h5><i class="fas fa-chart-bar"></i> 投票统计</h5>
                            <div class="vote-stats">
                                <div class="stat-card">
                                    <div class="stat-number">${userData.voteCount}</div>
                                    <div class="stat-label">获得票数</div>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h5><i class="fas fa-qrcode"></i> 二维码</h5>
                            <div class="qr-code-section">
                                ${userData.qrCode ? `
                                    <div class="qr-code-display">
                                        <img src="${userData.qrCode}" alt="二维码" class="qr-code-image">
                                        <p>扫描此二维码为该参与者投票</p>
                                    </div>
                                ` : '<p class="no-qr">暂无二维码</p>'}
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn-primary" onclick="editParticipant('${userData.id}')">
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
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

// ==================== 投票控制功能 ====================

/**
 * 设置投票控制事件监听器
 */
function setupVotingControls() {
    const toggleBtn = document.getElementById('toggleVotingBtn');
    const enableBtn = document.getElementById('enableVotingBtn');
    const disableBtn = document.getElementById('disableVotingBtn');
    const refreshBtn = document.getElementById('refreshStatusBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const resetBtn = document.getElementById('resetSettingsBtn');
    
    if (toggleBtn) toggleBtn.addEventListener('click', toggleVotingStatus);
    if (enableBtn) enableBtn.addEventListener('click', () => setVotingStatus(true));
    if (disableBtn) disableBtn.addEventListener('click', () => setVotingStatus(false));
    if (refreshBtn) refreshBtn.addEventListener('click', loadVotingSettings);
    if (saveBtn) saveBtn.addEventListener('click', saveAllVotingSettings);
    if (resetBtn) resetBtn.addEventListener('click', resetVotingSettings);
}

/**
 * 加载投票设置
 */
async function loadVotingSettings() {
    try {
        const response = await apiCall('/api/voting-settings');
        const result = await response.json();
        
        if (result.success) {
            updateVotingControlsUI(result.settings);
            updateVotingStatusIndicator(result.settings);
        } else {
            showError('加载投票设置失败');
        }
    } catch (error) {
        console.error('Load voting settings error:', error);
        showError('加载投票设置失败');
    }
}

/**
 * 更新投票控制界面
 */
function updateVotingControlsUI(settings) {
    // 更新投票消息
    const messageInput = document.getElementById('votingMessage');
    if (messageInput && settings.voting_message) {
        messageInput.value = settings.voting_message.value || '';
    }
    
    // 更新时间控制
    const startTimeInput = document.getElementById('votingStartTime');
    const endTimeInput = document.getElementById('votingEndTime');
    
    if (startTimeInput && settings.voting_start_time) {
        const startTime = settings.voting_start_time.value;
        if (startTime) {
            startTimeInput.value = formatDateTimeForInput(startTime);
        }
    }
    
    if (endTimeInput && settings.voting_end_time) {
        const endTime = settings.voting_end_time.value;
        if (endTime) {
            endTimeInput.value = formatDateTimeForInput(endTime);
        }
    }
    
    // 更新高级设置
    const maxVotesSelect = document.getElementById('maxVotesPerUser');
    if (maxVotesSelect && settings.max_votes_per_user) {
        maxVotesSelect.value = settings.max_votes_per_user.value || '2';
    }
    
    const allowSelfVoteCheckbox = document.getElementById('allowSelfVote');
    if (allowSelfVoteCheckbox && settings.allow_self_vote) {
        allowSelfVoteCheckbox.checked = settings.allow_self_vote.value === 'true';
    }
    
    // 启用按钮
    enableVotingControlButtons();
}

/**
 * 更新投票状态指示器
 */
function updateVotingStatusIndicator(settings) {
    const indicator = document.getElementById('votingStatusIndicator');
    const toggleBtn = document.getElementById('toggleVotingBtn');
    const enableBtn = document.getElementById('enableVotingBtn');
    const disableBtn = document.getElementById('disableVotingBtn');
    
    if (!indicator || !settings.voting_enabled) return;
    
    const isEnabled = settings.voting_enabled.value === 'true';
    
    // 更新状态指示器
    indicator.innerHTML = `
        <div class="status-badge ${isEnabled ? 'enabled' : 'disabled'}">
            <i class="fas fa-${isEnabled ? 'check-circle' : 'times-circle'}"></i>
            <span>投票${isEnabled ? '已开启' : '已关闭'}</span>
        </div>
    `;
    
    // 更新切换按钮
    if (toggleBtn) {
        toggleBtn.className = `btn-toggle ${isEnabled ? 'enabled' : 'disabled'}`;
        toggleBtn.innerHTML = `
            <i class="fas fa-${isEnabled ? 'toggle-on' : 'toggle-off'}"></i>
            ${isEnabled ? '关闭投票' : '开启投票'}
        `;
        toggleBtn.disabled = false;
    }
    
    // 更新快捷按钮状态
    if (enableBtn) {
        enableBtn.disabled = isEnabled;
    }
    if (disableBtn) {
        disableBtn.disabled = !isEnabled;
    }
}

/**
 * 启用投票控制按钮
 */
function enableVotingControlButtons() {
    const buttons = [
        'toggleVotingBtn',
        'enableVotingBtn', 
        'disableVotingBtn',
        'saveSettingsBtn',
        'resetSettingsBtn'
    ];
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button && button.disabled) {
            button.disabled = false;
        }
    });
}

/**
 * 切换投票状态
 */
async function toggleVotingStatus() {
    const toggleBtn = document.getElementById('toggleVotingBtn');
    const messageInput = document.getElementById('votingMessage');
    
    if (!toggleBtn) return;
    
    const originalText = toggleBtn.innerHTML;
    toggleBtn.disabled = true;
    toggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    
    try {
        const message = messageInput ? messageInput.value.trim() : '';
        
        const response = await apiCall('/api/voting-settings/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            await loadVotingSettings(); // 重新加载设置
        } else {
            showError(result.message || '切换投票状态失败');
        }
    } catch (error) {
        console.error('Toggle voting error:', error);
        showError('切换投票状态失败');
    } finally {
        toggleBtn.disabled = false;
        toggleBtn.innerHTML = originalText;
    }
}

/**
 * 设置投票状态
 */
async function setVotingStatus(enable) {
    const btn = document.getElementById(enable ? 'enableVotingBtn' : 'disableVotingBtn');
    const messageInput = document.getElementById('votingMessage');
    
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    
    try {
        const endpoint = enable ? '/api/voting-settings/enable' : '/api/voting-settings/disable';
        const message = messageInput ? messageInput.value.trim() : '';
        
        const response = await apiCall(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message);
            await loadVotingSettings(); // 重新加载设置
        } else {
            showError(result.message || `${enable ? '开启' : '关闭'}投票失败`);
        }
    } catch (error) {
        console.error('Set voting status error:', error);
        showError(`${enable ? '开启' : '关闭'}投票失败`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * 保存所有投票设置
 */
async function saveAllVotingSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (!saveBtn) return;
    
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    
    try {
        // 收集所有设置
        const settings = {
            voting_message: document.getElementById('votingMessage')?.value.trim() || '',
            voting_start_time: document.getElementById('votingStartTime')?.value || '',
            voting_end_time: document.getElementById('votingEndTime')?.value || '',
            max_votes_per_user: document.getElementById('maxVotesPerUser')?.value || '2',
            allow_self_vote: document.getElementById('allowSelfVote')?.checked ? 'true' : 'false'
        };
        
        const response = await apiCall('/api/voting-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('投票设置保存成功');
            await loadVotingSettings(); // 重新加载设置
        } else {
            showError(result.message || '保存投票设置失败');
        }
    } catch (error) {
        console.error('Save voting settings error:', error);
        showError('保存投票设置失败');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

/**
 * 重置投票设置
 */
async function resetVotingSettings() {
    if (!confirm('确定要重置所有投票设置为默认值吗？\n\n这将重置：\n• 投票开关状态\n• 提示消息\n• 时间限制\n• 高级设置\n\n此操作不可撤销！')) {
        return;
    }
    
    const resetBtn = document.getElementById('resetSettingsBtn');
    
    if (!resetBtn) return;
    
    const originalText = resetBtn.innerHTML;
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重置中...';
    
    try {
        const response = await apiCall('/api/voting-settings/reset', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('投票设置已重置为默认值');
            await loadVotingSettings(); // 重新加载设置
        } else {
            showError(result.message || '重置投票设置失败');
        }
    } catch (error) {
        console.error('Reset voting settings error:', error);
        showError('重置投票设置失败');
    } finally {
        resetBtn.disabled = false;
        resetBtn.innerHTML = originalText;
    }
}

/**
 * 格式化日期时间为输入框格式
 */
function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        // 格式化为 YYYY-MM-DDTHH:MM
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error('Format date error:', error);
        return '';
    }
}

// ==================== 参与者投票管理功能 ====================

/**
 * 查看参与者的投票记录
 */
async function viewParticipantVotes(userId, userName) {
    try {
        const response = await fetch(`/api/admin/vote-records?candidate=${userId}&limit=1000`, {
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load vote records');
        }

        const result = await response.json();
        console.log('Vote records API response:', result); // 调试日志
        if (result.success) {
            // 后端返回的数据结构是 { success: true, data: { records: [...], pagination: {...} } }
            const records = result.data?.records || result.records || [];
            console.log('Parsed records:', records); // 调试日志
            showVotesModal(userId, userName, records);
        } else {
            showError('加载投票记录失败');
        }
    } catch (error) {
        console.error('Load vote records error:', error);
        showError('加载投票记录失败');
    }
}

/**
 * 显示投票记录模态框
 */
function showVotesModal(userId, userName, votes) {
    // 先移除已存在的 modal,避免叠加
    const existingModal = document.getElementById('votesModal');
    if (existingModal) {
        existingModal.remove();
    }

    const validVotes = votes.filter(v => v.status === 'active');
    const disabledVotes = votes.filter(v => v.status === 'disabled');
    const discardedVotes = votes.filter(v => v.status === 'discarded');

    const modalHtml = `
        <div class="participant-modal" id="votesModal">
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3><i class="fas fa-vote-yea"></i> ${userName} 的投票记录</h3>
                    <button class="close-btn" onclick="closeVotesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="votes-stats" style="display: flex; gap: 12px; margin-bottom: 20px;">
                        <div class="stat-card" style="flex: 1; padding: 12px; background: #d4edda; border-radius: 8px;">
                            <strong style="color: #155724;">有效票: ${validVotes.length}</strong>
                        </div>
                        <div class="stat-card" style="flex: 1; padding: 12px; background: #fff3cd; border-radius: 8px;">
                            <strong style="color: #856404;">冻结票: ${disabledVotes.length}</strong>
                        </div>
                        <div class="stat-card" style="flex: 1; padding: 12px; background: #f8d7da; border-radius: 8px;">
                            <strong style="color: #721c24;">废弃票: ${discardedVotes.length}</strong>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label style="font-weight: 600;">批量操作:</label>
                            <button class="btn-secondary" onclick="selectAllVotes()" style="padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-check-square"></i> 全选
                            </button>
                            <button class="btn-secondary" onclick="deselectAllVotes()" style="padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-square"></i> 取消全选
                            </button>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-success" onclick="batchUpdateVoteStatus('active')" style="padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-check"></i> 恢复有效
                            </button>
                            <button class="btn-warning" onclick="batchUpdateVoteStatus('disabled')" style="padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-pause"></i> 冻结
                            </button>
                            <button class="btn-danger" onclick="batchUpdateVoteStatus('discarded')" style="padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-trash"></i> 废弃
                            </button>
                        </div>
                    </div>

                    <div style="max-height: 500px; overflow-y: auto;">
                        <table class="data-table" style="width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 40px;">
                                        <input type="checkbox" id="selectAllVotesCheckbox" onchange="toggleSelectAll(this)">
                                    </th>
                                    <th>投票人</th>
                                    <th>状态</th>
                                    <th>投票时间</th>
                                    <th>投票方式</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="votesTableBody">
                                ${votes.length === 0 ? `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                                            <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 12px;"></i>
                                            <p>暂无投票记录</p>
                                        </td>
                                    </tr>
                                ` : votes.map(vote => renderVoteRow(vote)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 存储投票数据以供批量操作使用
    window.currentVotesData = votes;
}

/**
 * 渲染单行投票记录
 */
function renderVoteRow(vote) {
    const statusConfig = {
        active: { class: 'success', label: '有效', icon: 'check' },
        disabled: { class: 'warning', label: '冻结', icon: 'pause' },
        discarded: { class: 'danger', label: '废弃', icon: 'trash' }
    };

    const status = statusConfig[vote.status] || statusConfig.active;
    const statusBadge = `<span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; background: #${status.class === 'success' ? 'd4edda; color: #155724' : status.class === 'warning' ? 'fff3cd; color: #856404' : 'f8d7da; color: #721c24'};">
        <i class="fas fa-${status.icon}"></i> ${status.label}
    </span>`;

    const voterName = vote.voterName || vote.voterNumericId || '未知';
    const voteTime = new Date(vote.voteTime).toLocaleString('zh-CN');
    const voteMethod = vote.voteMethod === 'qrcode' ? '扫码投票' : vote.voteMethod === 'manual' ? '手动投票' : '未知';

    return `
        <tr data-vote-id="${vote.id}" data-vote-status="${vote.status}">
            <td>
                <input type="checkbox" class="vote-checkbox" value="${vote.id}">
            </td>
            <td>
                <strong>${voterName}</strong>
            </td>
            <td>${statusBadge}</td>
            <td style="font-size: 13px; color: #666;">${voteTime}</td>
            <td style="font-size: 13px;">${voteMethod}</td>
            <td>
                <div style="display: flex; gap: 4px;">
                    <button class="btn-view" style="width: 28px; height: 28px; padding: 0; ${vote.status === 'active' ? 'display: none;' : ''}"
                            onclick="updateSingleVoteStatus(${vote.id}, 'active')" title="恢复有效">
                        <i class="fas fa-check" style="font-size: 12px;"></i>
                    </button>
                    <button class="btn-warning" style="width: 28px; height: 28px; padding: 0; ${vote.status === 'disabled' ? 'display: none;' : ''}"
                            onclick="updateSingleVoteStatus(${vote.id}, 'disabled')" title="冻结">
                        <i class="fas fa-pause" style="font-size: 12px;"></i>
                    </button>
                    <button class="btn-delete" style="width: 28px; height: 28px; padding: 0; ${vote.status === 'discarded' ? 'display: none;' : ''}"
                            onclick="updateSingleVoteStatus(${vote.id}, 'discarded')" title="废弃">
                        <i class="fas fa-trash" style="font-size: 12px;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * 关闭投票记录模态框
 */
function closeVotesModal() {
    const modal = document.getElementById('votesModal');
    if (modal) {
        modal.remove();
    }
    window.currentVotesData = null;
}

/**
 * 全选投票记录
 */
function selectAllVotes() {
    const checkboxes = document.querySelectorAll('.vote-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    document.getElementById('selectAllVotesCheckbox').checked = true;
}

/**
 * 取消全选投票记录
 */
function deselectAllVotes() {
    const checkboxes = document.querySelectorAll('.vote-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    document.getElementById('selectAllVotesCheckbox').checked = false;
}

/**
 * 切换全选状态
 */
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.vote-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

/**
 * 更新单条投票状态
 */
async function updateSingleVoteStatus(voteId, newStatus) {
    const statusLabels = {
        active: '恢复为有效',
        disabled: '冻结',
        discarded: '废弃'
    };

    if (!confirm(`确定要${statusLabels[newStatus]}这条投票记录吗?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/vote-records/${voteId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({
                status: newStatus,
                reason: `管理员手动${statusLabels[newStatus]}`
            })
        });

        // 处理401未授权错误
        if (response.status === 401 || response.status === 403) {
            showError('认证失败，请重新登录');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            return;
        }

        const result = await response.json();
        if (result.success) {
            showSuccess(`投票记录已${statusLabels[newStatus]}`);
            // 刷新模态框
            const modal = document.getElementById('votesModal');
            if (modal && window.currentVotesData && window.currentVotesData.length > 0) {
                const userId = window.currentVotesData[0]?.targetUserId;
                const userName = modal.querySelector('h3').textContent.replace(' 的投票记录', '').replace(' ', '').replace(/^[^\u4e00-\u9fa5]*/, '');
                if (userId) {
                    await viewParticipantVotes(userId, userName);
                }
            }
        } else {
            showError(result.message || '操作失败');
        }
    } catch (error) {
        console.error('Update vote status error:', error);
        showError('操作失败');
    }
}

/**
 * 批量更新投票状态
 */
async function batchUpdateVoteStatus(newStatus) {
    const checkboxes = document.querySelectorAll('.vote-checkbox:checked');
    if (checkboxes.length === 0) {
        showError('请先选择要操作的投票记录');
        return;
    }

    const voteIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const statusLabels = {
        active: '恢复为有效',
        disabled: '冻结',
        discarded: '废弃'
    };

    if (!confirm(`确定要将选中的 ${voteIds.length} 条投票记录${statusLabels[newStatus]}吗?`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/vote-records/batch-status', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({
                voteIds: voteIds,
                status: newStatus,
                reason: `管理员批量${statusLabels[newStatus]}`
            })
        });

        const result = await response.json();
        if (result.success) {
            showSuccess(`已${statusLabels[newStatus]} ${result.updated || voteIds.length} 条投票记录`);
            // 刷新模态框
            const modal = document.getElementById('votesModal');
            if (modal) {
                const userId = window.currentVotesData[0]?.targetUserId;
                const userName = modal.querySelector('h3').textContent.replace(' 的投票记录', '').replace(' ', '').replace(/^[^\u4e00-\u9fa5]*/, '');
                if (userId) {
                    await viewParticipantVotes(userId, userName);
                }
            }
        } else {
            showError(result.message || '批量操作失败');
        }
    } catch (error) {
        console.error('Batch update vote status error:', error);
        showError('批量操作失败');
    }
}

// ==================== Guest Management Functions ====================

let allGuests = [];

function filterGuests() {
    const searchTerm = document.getElementById('guestSearchInput').value.toLowerCase();
    const genderFilter = document.getElementById('guestGenderFilter').value;
    const sourceFilter = document.getElementById('guestSourceFilter').value;

    const filtered = allGuests.filter(guest => {
        const matchesSearch = guest.name.toLowerCase().includes(searchTerm);
        const matchesGender = !genderFilter || guest.gender === genderFilter;
        const matchesSource = !sourceFilter || guest.source === sourceFilter;
        return matchesSearch && matchesGender && matchesSource;
    });

    updateGuestsTable(filtered);
}

async function showAddGuestModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addGuestModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> 添加嘉宾</h3>
                <button class="close-btn" onclick="closeModal('addGuestModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="addGuestForm">
                    <div class="form-group">
                        <label for="guestName">姓名 *</label>
                        <input type="text" id="guestName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="guestGender">性别 *</label>
                        <select id="guestGender" class="form-control" required>
                            <option value="">请选择</option>
                            <option value="male">男士</option>
                            <option value="female">女士</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="guestNotes">备注</label>
                        <textarea id="guestNotes" class="form-control" rows="3"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="closeModal('addGuestModal')">取消</button>
                <button type="submit" form="addGuestForm" class="btn-primary">添加</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('addGuestForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addGuest();
    });
}

async function addGuest() {
    const name = document.getElementById('guestName').value.trim();
    const gender = document.getElementById('guestGender').value;
    const notes = document.getElementById('guestNotes').value.trim();

    if (!name || !gender) {
        showError('请填写姓名和性别');
        return;
    }

    try {
        const response = await fetch('/api/admin/guests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({ name, gender, notes })
        });

        const result = await response.json();
        if (result.success) {
            showSuccess('嘉宾添加成功');
            closeModal('addGuestModal');
            await loadGuestsData();
        } else {
            showError(result.message || '添加失败');
        }
    } catch (error) {
        console.error('Add guest error:', error);
        showError('添加嘉宾失败');
    }
}

async function editGuest(guestId) {
    try {
        const response = await fetch('/api/admin/guests', {
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            }
        });

        const result = await response.json();
        if (!result.success) {
            showError('获取嘉宾信息失败');
            return;
        }

        const guest = result.guests.find(g => g.id === guestId);
        if (!guest) {
            showError('嘉宾不存在');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editGuestModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> 编辑嘉宾</h3>
                    <button class="close-btn" onclick="closeModal('editGuestModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editGuestForm">
                        <input type="hidden" id="editGuestId" value="${guest.id}">
                        <div class="form-group">
                            <label for="editGuestName">姓名 *</label>
                            <input type="text" id="editGuestName" class="form-control" value="${guest.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editGuestGender">性别 *</label>
                            <select id="editGuestGender" class="form-control" required>
                                <option value="male" ${guest.gender === 'male' ? 'selected' : ''}>男士</option>
                                <option value="female" ${guest.gender === 'female' ? 'selected' : ''}>女士</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editGuestNotes">备注</label>
                            <textarea id="editGuestNotes" class="form-control" rows="3">${guest.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal('editGuestModal')">取消</button>
                    <button type="submit" form="editGuestForm" class="btn-primary">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('editGuestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateGuest();
        });
    } catch (error) {
        console.error('Edit guest error:', error);
        showError('编辑嘉宾失败');
    }
}

async function updateGuest() {
    const id = document.getElementById('editGuestId').value;
    const name = document.getElementById('editGuestName').value.trim();
    const gender = document.getElementById('editGuestGender').value;
    const notes = document.getElementById('editGuestNotes').value.trim();

    if (!name || !gender) {
        showError('请填写姓名和性别');
        return;
    }

    try {
        const response = await fetch(`/api/admin/guests/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({ name, gender, notes })
        });

        const result = await response.json();
        if (result.success) {
            showSuccess('嘉宾更新成功');
            closeModal('editGuestModal');
            await loadGuestsData();
        } else {
            showError(result.message || '更新失败');
        }
    } catch (error) {
        console.error('Update guest error:', error);
        showError('更新嘉宾失败');
    }
}

async function deleteGuest(guestId, guestName) {
    if (!confirm(`确定要删除嘉宾 "${guestName}" 吗?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/guests/${guestId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAdminToken()}`
            }
        });

        const result = await response.json();
        if (result.success) {
            showSuccess('嘉宾删除成功');
            await loadGuestsData();
        } else {
            showError(result.message || '删除失败');
        }
    } catch (error) {
        console.error('Delete guest error:', error);
        showError('删除嘉宾失败');
    }
}

async function showBulkImportGuestsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'bulkImportGuestsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3><i class="fas fa-file-import"></i> 批量导入嘉宾</h3>
                <button class="close-btn" onclick="closeModal('bulkImportGuestsModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>嘉宾数据 (JSON格式)</label>
                    <textarea id="bulkGuestsData" class="form-control" rows="10" placeholder='[{"name": "张三", "gender": "male", "notes": "备注"}, {"name": "李四", "gender": "female"}]'></textarea>
                    <small class="text-muted">格式: [{"name": "姓名", "gender": "male/female", "notes": "备注"}]</small>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="closeModal('bulkImportGuestsModal')">取消</button>
                <button type="button" class="btn-primary" onclick="bulkImportGuests()">导入</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function bulkImportGuests() {
    const dataText = document.getElementById('bulkGuestsData').value.trim();

    if (!dataText) {
        showError('请输入嘉宾数据');
        return;
    }

    let guests;
    try {
        guests = JSON.parse(dataText);
        if (!Array.isArray(guests)) {
            throw new Error('数据必须是数组格式');
        }
    } catch (error) {
        showError('JSON格式错误: ' + error.message);
        return;
    }

    // 验证数据格式
    const invalid = guests.find(g => !g.name || !g.gender);
    if (invalid) {
        showError('每条记录必须包含 name 和 gender 字段');
        return;
    }

    try {
        const response = await fetch('/api/admin/guests/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({ guests })
        });

        const result = await response.json();
        if (result.success) {
            showSuccess(`成功导入 ${result.imported} 位嘉宾${result.failed ? `,失败 ${result.failed} 条` : ''}`);
            closeModal('bulkImportGuestsModal');
            await loadGuestsData();
        } else {
            showError(result.message || '导入失败');
        }
    } catch (error) {
        console.error('Bulk import guests error:', error);
        showError('批量导入失败');
    }
}