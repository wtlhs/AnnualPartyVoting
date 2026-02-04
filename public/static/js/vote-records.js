// 投票记录管理页面 JavaScript
console.log('[vote-records.js] 文件已加载');

document.addEventListener('DOMContentLoaded', function() {
    console.log('[vote-records.js] DOM已加载完成,开始初始化');
    initializeVoteRecords();
});

let currentPage = 1;
let pageSize = 20;
let totalRecords = 0;
let totalPages = 0;  // 添加总页数变量
let selectedRecords = new Set();

/**
 * 关闭所有打开的模态窗口
 */
function closeAllModals() {
    console.log('[closeAllModals] 开始清理所有模态窗口...');

    // 关闭投票记录详情模态窗口
    const voteRecordModal = document.getElementById('voteRecordModal');
    if (voteRecordModal) {
        voteRecordModal.style.display = 'none';
        console.log('[closeAllModals] 已关闭 voteRecordModal');
    }

    // 关闭批量确认模态窗口
    const batchConfirmModal = document.getElementById('batchConfirmModal');
    if (batchConfirmModal) {
        batchConfirmModal.style.display = 'none';
        console.log('[closeAllModals] 已关闭 batchConfirmModal');
    }

    // 关闭导出模态窗口
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.style.display = 'none';
        console.log('[closeAllModals] 已关闭 exportModal');
    }

    // 移除所有动态创建的确认对话框 (包括有样式类 .modal 的元素)
    const allModals = document.querySelectorAll('.modal');
    let removedCount = 0;
    allModals.forEach(modal => {
        // 只移除动态创建的(没有 id 的)模态窗口
        if (!modal.id && modal.parentNode) {
            modal.parentNode.removeChild(modal);
            removedCount++;
        }
    });
    console.log(`[closeAllModals] 已移除 ${removedCount} 个动态模态窗口`);
}
let currentFilters = {};
let allVoteRecords = [];
let paginationData = null;  // 保存完整的分页数据

// 使用统一的认证管理器
const auth = window.adminAuth;

// 全局API调用包装器，使用认证管理器
async function apiCall(url, options = {}) {
    return await auth.apiCall(url, options);
}

// 用户体验增强功能
const UXManager = {
    // 操作反馈管理
    feedback: {
        container: null,
        
        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'operation-feedback';
                document.body.appendChild(this.container);
            }
        },
        
        show(type, title, message, duration = 5000) {
            this.init();
            
            const feedbackId = 'feedback-' + Date.now();
            const feedbackItem = document.createElement('div');
            feedbackItem.className = `feedback-item ${type}`;
            feedbackItem.id = feedbackId;
            
            feedbackItem.innerHTML = `
                <div class="feedback-content">
                    <div class="feedback-icon">
                        <i class="fas fa-${this.getIcon(type)}"></i>
                    </div>
                    <div class="feedback-text">
                        <div class="feedback-title">${title}</div>
                        <div class="feedback-message">${message}</div>
                    </div>
                    <button class="feedback-close" onclick="UXManager.feedback.hide('${feedbackId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="feedback-progress">
                    <div class="feedback-progress-bar"></div>
                </div>
            `;
            
            this.container.appendChild(feedbackItem);
            
            // 自动进度条
            if (duration > 0) {
                const progressBar = feedbackItem.querySelector('.feedback-progress-bar');
                let progress = 0;
                const interval = 50;
                const increment = (interval / duration) * 100;
                
                const progressTimer = setInterval(() => {
                    progress += increment;
                    progressBar.style.width = progress + '%';
                    
                    if (progress >= 100) {
                        clearInterval(progressTimer);
                        this.hide(feedbackId);
                    }
                }, interval);
            }
            
            return feedbackId;
        },
        
        hide(feedbackId) {
            const item = document.getElementById(feedbackId);
            if (item) {
                item.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (item.parentNode) {
                        item.parentNode.removeChild(item);
                    }
                }, 300);
            }
        },
        
        getIcon(type) {
            const icons = {
                success: 'check',
                error: 'exclamation-triangle',
                warning: 'exclamation',
                info: 'info'
            };
            return icons[type] || 'info';
        }
    },
    
    // 加载状态管理
    loading: {
        show(element, text = '加载中...') {
            if (typeof element === 'string') {
                element = document.querySelector(element);
            }
            
            if (!element) return;
            
            element.classList.add('btn-loading');
            element.disabled = true;
            
            if (element.tagName === 'BUTTON') {
                element.dataset.originalText = element.innerHTML;
                element.innerHTML = `<span>${text}</span>`;
            }
        },
        
        hide(element) {
            if (typeof element === 'string') {
                element = document.querySelector(element);
            }
            
            if (!element) return;
            
            element.classList.remove('btn-loading');
            element.disabled = false;
            
            if (element.tagName === 'BUTTON' && element.dataset.originalText) {
                element.innerHTML = element.dataset.originalText;
                delete element.dataset.originalText;
            }
        }
    },
    
    // 确认对话框
    confirm: {
        show(options) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                
                modal.innerHTML = `
                    <div class="confirmation-dialog">
                        <div class="confirmation-header">
                            <div class="confirmation-icon ${options.type || 'warning'}">
                                <i class="fas fa-${this.getIcon(options.type)}"></i>
                            </div>
                            <h3 class="confirmation-title">${options.title || '确认操作'}</h3>
                        </div>
                        <div class="confirmation-body">
                            <div class="confirmation-message">${options.message}</div>
                            ${options.details ? `
                                <div class="confirmation-details">
                                    <h5>操作详情：</h5>
                                    <ul class="confirmation-list">
                                        ${options.details.map(detail => `<li>${detail}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${options.requireReason ? `
                                <div class="confirmation-input">
                                    <label for="confirmReason">操作原因 <span>*</span>：</label>
                                    <textarea id="confirmReason" placeholder="请输入操作原因..." required></textarea>
                                </div>
                            ` : ''}
                        </div>
                        <div class="confirmation-footer">
                            <button class="btn-cancel">取消</button>
                            <button class="btn-confirm" ${options.requireReason ? 'disabled' : ''}>
                                ${options.confirmText || '确认'}
                            </button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                const cancelBtn = modal.querySelector('.btn-cancel');
                const confirmBtn = modal.querySelector('.btn-confirm');
                const reasonInput = modal.querySelector('#confirmReason');
                
                // 原因输入验证
                if (reasonInput) {
                    reasonInput.addEventListener('input', () => {
                        confirmBtn.disabled = !reasonInput.value.trim();
                    });
                }
                
                cancelBtn.addEventListener('click', () => {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    document.removeEventListener('keydown', handleEsc);
                    resolve({ confirmed: false });
                });

                confirmBtn.addEventListener('click', () => {
                    const reason = reasonInput ? reasonInput.value.trim() : '';
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    document.removeEventListener('keydown', handleEsc);
                    resolve({
                        confirmed: true,
                        reason: reason
                    });
                });

                // ESC键取消
                const handleEsc = (e) => {
                    if (e.key === 'Escape') {
                        if (modal && modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }
                        document.removeEventListener('keydown', handleEsc);
                        resolve({ confirmed: false });
                    }
                };
                document.addEventListener('keydown', handleEsc);
            });
        },
        
        getIcon(type) {
            const icons = {
                warning: 'exclamation-triangle',
                danger: 'exclamation-triangle',
                info: 'info-circle'
            };
            return icons[type] || 'exclamation-triangle';
        }
    },
    
    // 进度指示器
    progress: {
        bar: null,
        
        show() {
            if (!this.bar) {
                this.bar = document.createElement('div');
                this.bar.className = 'progress-indicator';
                this.bar.innerHTML = '<div class="progress-bar-animated"></div>';
                document.body.appendChild(this.bar);
            }
            this.bar.style.display = 'block';
        },
        
        update(percent) {
            if (this.bar) {
                const progressBar = this.bar.querySelector('.progress-bar-animated');
                progressBar.style.width = percent + '%';
            }
        },
        
        hide() {
            if (this.bar) {
                this.bar.style.display = 'none';
            }
        }
    },
    
    // 网络状态监控
    network: {
        indicator: null,
        
        init() {
            if (!this.indicator) {
                this.indicator = document.createElement('div');
                this.indicator.className = 'network-status';
                document.body.appendChild(this.indicator);
            }
            
            window.addEventListener('online', () => this.showStatus('online', '网络已连接'));
            window.addEventListener('offline', () => this.showStatus('offline', '网络已断开'));
        },
        
        showStatus(type, message) {
            this.indicator.className = `network-status ${type} show`;
            this.indicator.innerHTML = `
                <i class="fas fa-${type === 'online' ? 'wifi' : 'wifi-slash'}"></i>
                ${message}
            `;
            
            setTimeout(() => {
                this.indicator.classList.remove('show');
            }, 3000);
        }
    }
};

function initializeVoteRecords() {
    // 初始化认证管理器
    if (!auth.init()) {
        return; // 认证失败，已重定向
    }
    
    // 初始化用户体验增强功能
    UXManager.network.init();
    
    setupEventListeners();
    loadVoteRecords();
}

function checkAdminAuth() {
    // 使用认证管理器检查认证状态
    return auth.isAuthenticated();
}

async function validateSession() {
    // 使用认证管理器验证会话
    return await auth.validateSession();
}

function handleSessionExpired() {
    // 使用认证管理器处理会话过期
    auth.handleSessionExpired();
}

function scheduleSessionRefresh(remainingTime) {
    // 认证管理器会自动处理会话刷新
    // 这个函数保留以保持兼容性，但实际工作由认证管理器完成
}

function setupEventListeners() {
    // 侧边栏切换
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // 刷新数据
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadVoteRecords();
            showSuccess('数据已刷新');
        });
    }
    
    // 导出记录
    const exportBtn = document.getElementById('exportVoteRecordsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', showExportModal);
    }
    
    // 筛选和搜索
    setupFilterListeners();
    
    // 批量操作
    setupBatchOperations();
    
    // 全选复选框
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAll);
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function setupFilterListeners() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const methodFilter = document.getElementById('methodFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const sortBy = document.getElementById('sortBy');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    // 搜索输入 - 防抖处理
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 500);
        });
    }
    
    // 筛选器变化
    [statusFilter, methodFilter, dateFromInput, dateToInput, sortBy].forEach(element => {
        if (element) {
            element.addEventListener('change', applyFilters);
        }
    });
    
    // 清空筛选
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
}

function setupBatchOperations() {
    const batchActivateBtn = document.getElementById('batchActivateBtn');
    const batchDeactivateBtn = document.getElementById('batchDeactivateBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const selectAllVisibleBtn = document.getElementById('selectAllVisibleBtn');
    
    if (batchActivateBtn) {
        batchActivateBtn.addEventListener('click', () => showBatchConfirm('activate'));
    }
    
    if (batchDeactivateBtn) {
        batchDeactivateBtn.addEventListener('click', () => showBatchConfirm('deactivate'));
    }
    
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelection);
    }
    
    if (selectAllVisibleBtn) {
        selectAllVisibleBtn.addEventListener('click', selectAllVisible);
    }
}

function selectAllVisible() {
    const checkboxes = document.querySelectorAll('.record-checkbox');
    const previousCount = selectedRecords.size;
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const recordId = parseInt(checkbox.dataset.recordId);
        selectedRecords.add(recordId);
    });
    
    updateRowSelection();
    updateSelectAllCheckbox();
    updateBatchOperationsVisibility();
    
    const newSelections = selectedRecords.size - previousCount;
    if (newSelections > 0) {
        UXManager.feedback.show('info', '批量选择完成', 
            `已选择当前页面的 ${newSelections} 条记录，总计 ${selectedRecords.size} 条`, 3000);
    }
}

function clearSelection() {
    const previousCount = selectedRecords.size;
    
    selectedRecords.clear();
    
    // 清空所有复选框
    document.querySelectorAll('.record-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    updateRowSelection();
    updateSelectAllCheckbox();
    updateBatchOperationsVisibility();
    
    if (previousCount > 0) {
        UXManager.feedback.show('info', '选择已清空', 
            `已取消选择 ${previousCount} 条记录`, 2000);
    }
}

// 工具函数
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function getDefaultAvatar(gender) {
    return gender === 'female' 
        ? '/static/images/default-female-avatar.svg'
        : '/static/images/default-male-avatar.svg';
}

function animateNumber(element, from, to, duration = 1000) {
    const startTime = performance.now();
    const difference = to - from;
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(from + difference * easeOutQuart);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// 键盘快捷键增强
function handleKeyboardShortcuts(event) {
    // 防止在输入框中触发快捷键
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'r':
                event.preventDefault();
                loadVoteRecords();
                UXManager.feedback.show('info', '数据刷新', '正在重新加载数据...', 2000);
                break;
            case 'e':
                event.preventDefault();
                showExportModal();
                break;
            case 'a':
                event.preventDefault();
                toggleSelectAll();
                break;
            case 'd':
                if (selectedRecords.size > 0) {
                    event.preventDefault();
                    showBatchConfirm('deactivate');
                }
                break;
            case 'u':
                if (selectedRecords.size > 0) {
                    event.preventDefault();
                    showBatchConfirm('activate');
                }
                break;
            case 'f':
                event.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                break;
        }
    }
    
    if (event.key === 'Escape') {
        closeAllModals();
        if (selectedRecords.size > 0) {
            clearSelection();
        }
    }
    
    if (event.key === 'Delete' && selectedRecords.size > 0) {
        event.preventDefault();
        showBatchConfirm('deactivate');
    }
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = !selectAllCheckbox.checked;
        handleSelectAll({ target: selectAllCheckbox });
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// 侧边栏增强
function toggleSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const main = document.querySelector('.admin-main');
    const overlay = document.querySelector('.sidebar-overlay') || createSidebarOverlay();
    
    if (window.innerWidth <= 768) {
        // 移动端：使用覆盖层
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    } else {
        // 桌面端：调整布局
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('expanded');
    }
}

function createSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', toggleSidebar);
    document.body.appendChild(overlay);
    return overlay;
}

// 响应式处理
function handleResize() {
    const sidebar = document.querySelector('.admin-sidebar');
    const main = document.querySelector('.admin-main');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (window.innerWidth > 768) {
        // 桌面端：清除移动端样式
        if (sidebar) sidebar.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
    } else {
        // 移动端：清除桌面端样式
        if (sidebar) sidebar.classList.remove('collapsed');
        if (main) main.classList.remove('expanded');
    }
}

// 初始化响应式处理
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 100);
});

// 触摸设备优化
if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
    
    // 添加触摸反馈
    document.addEventListener('touchstart', function(e) {
        if (e.target.matches('button, .btn, .record-actions button')) {
            e.target.classList.add('touch-active');
        }
    });
    
    document.addEventListener('touchend', function(e) {
        if (e.target.matches('button, .btn, .record-actions button')) {
            setTimeout(() => {
                e.target.classList.remove('touch-active');
            }, 150);
        }
    });
}

// 页面可见性处理
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 页面重新可见时，检查数据是否需要刷新
        const lastUpdate = localStorage.getItem('voteRecordsLastUpdate');
        const now = Date.now();
        
        if (!lastUpdate || now - parseInt(lastUpdate) > 5 * 60 * 1000) { // 5分钟
            loadVoteRecords();
            localStorage.setItem('voteRecordsLastUpdate', now.toString());
        }
    }
});

// 错误边界处理
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    UXManager.feedback.show('error', '系统错误', 
        '页面发生了未预期的错误，请刷新页面重试');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    UXManager.feedback.show('error', '网络错误', 
        '网络请求失败，请检查网络连接');
});

// 导出功能增强
async function showExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // 更新当前筛选结果数量
        const currentFilterCount = document.getElementById('currentFilterCount');
        if (currentFilterCount) {
            const filterText = Object.keys(currentFilters).length > 0 
                ? `(当前筛选结果: ${totalRecords} 条)`
                : `(所有记录: ${totalRecords} 条)`;
            currentFilterCount.textContent = filterText;
        }
        
        UXManager.feedback.show('info', '导出功能', '请选择导出格式和字段', 3000);
    }
}

// 退出登录增强
async function logout() {
    const result = await UXManager.confirm.show({
        type: 'warning',
        title: '确认退出',
        message: '您确定要退出管理后台吗？',
        confirmText: '确认退出'
    });
    
    if (result.confirmed) {
        UXManager.feedback.show('info', '正在退出', '正在安全退出系统...', 2000);
        
        // 使用认证管理器的退出功能
        if (auth && auth.logout) {
            auth.logout();
        } else {
            // 备用退出逻辑
            localStorage.removeItem('adminToken');
            sessionStorage.clear();
            window.location.href = '/admin';
        }
    }
}

async function loadVoteRecords() {
    // 关闭所有打开的模态窗口
    closeAllModals();

    const refreshBtn = document.getElementById('refreshDataBtn');
    UXManager.loading.show(refreshBtn, '刷新中...');
    UXManager.progress.show();

    try {
        // 构建查询参数
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize,
            ...currentFilters
        });
        
        UXManager.progress.update(30);
        
        const response = await apiCall(`/api/admin/vote-records?${params}`);
        
        UXManager.progress.update(60);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                UXManager.feedback.show('error', '认证失败', '会话已过期，请重新登录');
                setTimeout(() => {
                    window.location.href = '/admin';
                }, 2000);
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();

        UXManager.progress.update(90);

        if (result.success) {
            // 后端返回的数据结构是 { success: true, data: { records: [], pagination: {} } }
            const voteData = result.data || result;
            allVoteRecords = voteData.records || [];
            paginationData = voteData.pagination || null;  // 保存完整的分页数据
            totalRecords = paginationData?.total || 0;
            totalPages = paginationData?.totalPages || 0;  // 更新总页数

            updateVoteRecordsDisplay(voteData.records || []);
            updateStatistics(voteData.statistics || {});
            updatePagination();
            updateHeaderStats(voteData.statistics || {});

            UXManager.progress.update(100);

            // 显示加载成功反馈
            if (currentPage === 1 && Object.keys(currentFilters).length === 0) {
                UXManager.feedback.show('success', '数据加载完成', `成功加载 ${voteData.records?.length || 0} 条投票记录`);
            }
        } else {
            throw new Error(result.message || '加载投票记录失败');
        }
        
    } catch (error) {
        console.error('Load vote records error:', error);
        UXManager.feedback.show('error', '加载失败', error.message || '加载投票记录失败，请检查网络连接后重试');
        
        // 显示错误状态
        showErrorState('加载失败', error.message || '无法加载投票记录，请重试');
    } finally {
        UXManager.loading.hide(refreshBtn);
        UXManager.progress.hide();
    }
}

function showErrorState(title, message) {
    const tbody = document.getElementById('voteRecordsTableBody');
    const mobileContainer = document.getElementById('mobileCardsView');
    
    const errorContent = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="error-actions">
                <button class="btn-retry" onclick="loadVoteRecords()">
                    <i class="fas fa-redo"></i> 重试
                </button>
                <button class="btn-home" onclick="window.location.href='/admin'">
                    <i class="fas fa-home"></i> 返回首页
                </button>
            </div>
        </div>
    `;
    
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8">${errorContent}</td></tr>`;
    }
    
    if (mobileContainer) {
        mobileContainer.innerHTML = errorContent;
    }
}

function updateVoteRecordsDisplay(records) {
    updateDesktopTableView(records);
    updateMobileCardsView(records);
}

function updateDesktopTableView(records) {
    const tbody = document.getElementById('voteRecordsTableBody');
    if (!tbody) return;
    
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-vote-yea"></i>
                    <p>暂无投票记录</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = records.map(record => `
        <tr data-record-id="${record.id}" ${selectedRecords.has(record.id) ? 'class="selected"' : ''}>
            <td>
                <input type="checkbox" class="record-checkbox" 
                       data-record-id="${record.id}" 
                       ${selectedRecords.has(record.id) ? 'checked' : ''}>
            </td>
            <td>
                <div class="voter-info">
                    <img src="${record.voterAvatar || getDefaultAvatar(record.voterGender)}" 
                         alt="${record.voterName}" class="voter-avatar"
                         onerror="this.src='${getDefaultAvatar(record.voterGender)}'">
                    <span class="voter-name">${record.voterName}</span>
                </div>
            </td>
            <td>
                <div class="candidate-info">
                    <img src="${record.candidateAvatar || getDefaultAvatar(record.candidateGender)}" 
                         alt="${record.candidateName}" class="candidate-avatar"
                         onerror="this.src='${getDefaultAvatar(record.candidateGender)}'">
                    <span class="candidate-name">${record.candidateName}</span>
                </div>
            </td>
            <td>
                <div class="vote-time">${formatDateTime(record.createdAt)}</div>
            </td>
            <td>
                <span class="vote-status ${record.status}">
                    <i class="fas fa-${record.status === 'active' ? 'check-circle' : 'times-circle'}"></i>
                    ${record.status === 'active' ? '有效' : '无效'}
                </span>
            </td>
            <td>
                <span class="vote-method ${record.voteMethod}">
                    <i class="fas fa-${record.voteMethod === 'qr_code' ? 'qrcode' : 'search'}"></i>
                    ${record.voteMethod === 'qr_code' ? '二维码' : '姓名搜索'}
                </span>
            </td>
            <td>
                <span class="ip-address">${record.ipAddress || 'N/A'}</span>
            </td>
            <td>
                <div class="record-actions">
                    <button class="btn-view" onclick="viewVoteRecord('${record.id}')" title="查看详情">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${record.status === 'active' ? 
                        `<button class="btn-deactivate" onclick="toggleVoteStatus('${record.id}', 'inactive')" title="作废">
                            <i class="fas fa-ban"></i>
                        </button>` :
                        `<button class="btn-activate" onclick="toggleVoteStatus('${record.id}', 'active')" title="激活">
                            <i class="fas fa-check"></i>
                        </button>`
                    }
                    <button class="btn-history" onclick="viewOperationHistory('${record.id}')" title="操作历史">
                        <i class="fas fa-history"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // 添加复选框事件监听
    tbody.querySelectorAll('.record-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleRecordSelection);
    });
}

function updateMobileCardsView(records) {
    const container = document.getElementById('mobileCardsView');
    if (!container) return;
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-vote-yea"></i>
                <p>暂无投票记录</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = records.map(record => `
        <div class="vote-record-card ${selectedRecords.has(record.id) ? 'selected' : ''}" 
             data-record-id="${record.id}">
            <div class="card-header">
                <input type="checkbox" class="card-checkbox record-checkbox" 
                       data-record-id="${record.id}" 
                       ${selectedRecords.has(record.id) ? 'checked' : ''}>
                <div class="card-main-info">
                    <div class="card-vote-info">
                        <div class="voter-info">
                            <img src="${record.voterAvatar || getDefaultAvatar(record.voterGender)}" 
                                 alt="${record.voterName}" class="voter-avatar"
                                 onerror="this.src='${getDefaultAvatar(record.voterGender)}'">
                            <span class="voter-name">${record.voterName}</span>
                        </div>
                        <i class="fas fa-arrow-right card-vote-arrow"></i>
                        <div class="candidate-info">
                            <img src="${record.candidateAvatar || getDefaultAvatar(record.candidateGender)}" 
                                 alt="${record.candidateName}" class="candidate-avatar"
                                 onerror="this.src='${getDefaultAvatar(record.candidateGender)}'">
                            <span class="candidate-name">${record.candidateName}</span>
                        </div>
                    </div>
                    <div class="card-meta">
                        <span class="vote-status ${record.status}">
                            <i class="fas fa-${record.status === 'active' ? 'check-circle' : 'times-circle'}"></i>
                            ${record.status === 'active' ? '有效' : '无效'}
                        </span>
                        <span class="vote-method ${record.voteMethod}">
                            <i class="fas fa-${record.voteMethod === 'qr_code' ? 'qrcode' : 'search'}"></i>
                            ${record.voteMethod === 'qr_code' ? '二维码' : '姓名搜索'}
                        </span>
                        <span class="vote-time">${formatDateTime(record.createdAt)}</span>
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-view" onclick="viewVoteRecord('${record.id}')" title="查看详情">
                    <i class="fas fa-eye"></i>
                </button>
                ${record.status === 'active' ? 
                    `<button class="btn-deactivate" onclick="toggleVoteStatus('${record.id}', 'inactive')" title="作废">
                        <i class="fas fa-ban"></i>
                    </button>` :
                    `<button class="btn-activate" onclick="toggleVoteStatus('${record.id}', 'active')" title="激活">
                        <i class="fas fa-check"></i>
                    </button>`
                }
                <button class="btn-history" onclick="viewOperationHistory('${record.id}')" title="操作历史">
                    <i class="fas fa-history"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // 添加复选框事件监听
    container.querySelectorAll('.record-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleRecordSelection);
    });
}

function updateStatistics(stats) {
    const elements = {
        totalVotesCount: stats.totalVotes || 0,
        activeVotesCount: stats.activeVotes || 0,
        inactiveVotesCount: stats.inactiveVotes || 0,
        uniqueVotersCount: stats.uniqueVoters || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            animateNumber(element, parseInt(element.textContent) || 0, value);
        }
    });
}

function updateHeaderStats(stats) {
    const headerTotalVotes = document.getElementById('headerTotalVotes');
    const headerActiveVotes = document.getElementById('headerActiveVotes');
    
    if (headerTotalVotes) headerTotalVotes.textContent = stats.totalVotes || 0;
    if (headerActiveVotes) headerActiveVotes.textContent = stats.activeVotes || 0;
}

function updatePagination() {
    const container = document.getElementById('tablePagination');
    if (!container) return;

    // 使用保存的分页数据或计算默认值
    const actualTotalPages = totalPages || Math.ceil(totalRecords / pageSize);
    const startRecord = totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const endRecord = Math.min(currentPage * pageSize, totalRecords);

    container.innerHTML = `
        <div class="pagination-info">
            显示第 ${startRecord}-${endRecord} 条，共 ${totalRecords} 条记录
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-angle-double-left"></i>
            </button>
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-angle-left"></i>
            </button>

            ${generatePageNumbers(currentPage, actualTotalPages)}

            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === actualTotalPages ? 'disabled' : ''}>
                <i class="fas fa-angle-right"></i>
            </button>
            <button class="pagination-btn" onclick="goToPage(${actualTotalPages})" ${currentPage === actualTotalPages ? 'disabled' : ''}>
                <i class="fas fa-angle-double-right"></i>
            </button>
        </div>
        <div class="page-size-selector">
            每页显示
            <select onchange="changePageSize(this.value)">
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            条
        </div>
    `;
}

function generatePageNumbers(current, total) {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
        pages.push(`
            <button class="pagination-btn ${i === current ? 'active' : ''}" 
                    onclick="goToPage(${i})">${i}</button>
        `);
    }
    
    return pages.join('');
}

function goToPage(page) {
    if (page < 1 || page > Math.ceil(totalRecords / pageSize)) return;
    
    currentPage = page;
    loadVoteRecords();
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1;
    loadVoteRecords();
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const methodFilter = document.getElementById('methodFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const sortBy = document.getElementById('sortBy');
    
    const previousFilters = { ...currentFilters };
    currentFilters = {};
    
    if (searchInput && searchInput.value.trim()) {
        currentFilters.search = searchInput.value.trim();
    }
    
    if (statusFilter && statusFilter.value) {
        currentFilters.status = statusFilter.value;
    }
    
    if (methodFilter && methodFilter.value) {
        currentFilters.method = methodFilter.value;
    }
    
    if (dateFromInput && dateFromInput.value) {
        currentFilters.dateFrom = dateFromInput.value;
    }
    
    if (dateToInput && dateToInput.value) {
        currentFilters.dateTo = dateToInput.value;
    }
    
    if (sortBy && sortBy.value) {
        currentFilters.sort = sortBy.value;
    }
    
    // 检查筛选条件是否有变化
    const filtersChanged = JSON.stringify(previousFilters) !== JSON.stringify(currentFilters);
    
    if (filtersChanged) {
        currentPage = 1;
        clearSelection();
        
        // 显示筛选反馈
        const filterCount = Object.keys(currentFilters).length;
        if (filterCount > 0) {
            UXManager.feedback.show('info', '筛选已应用', 
                `已应用 ${filterCount} 个筛选条件`, 3000);
        }
        
        loadVoteRecords();
    }
}

function clearFilters() {
    // 清空所有筛选控件
    const controls = [
        { id: 'searchInput', value: '' },
        { id: 'statusFilter', value: '' },
        { id: 'methodFilter', value: '' },
        { id: 'dateFromInput', value: '' },
        { id: 'dateToInput', value: '' },
        { id: 'sortBy', value: 'created_at_desc' }
    ];
    
    controls.forEach(control => {
        const element = document.getElementById(control.id);
        if (element) {
            element.value = control.value;
        }
    });
    
    const hadFilters = Object.keys(currentFilters).length > 0;
    
    currentFilters = {};
    currentPage = 1;
    clearSelection();
    
    if (hadFilters) {
        UXManager.feedback.show('info', '筛选已清空', '所有筛选条件已重置', 3000);
    }
    
    loadVoteRecords();
}

function handleSelectAll(event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.record-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const recordId = parseInt(checkbox.dataset.recordId);
        
        if (isChecked) {
            selectedRecords.add(recordId);
        } else {
            selectedRecords.delete(recordId);
        }
    });
    
    updateRowSelection();
    updateBatchOperationsVisibility();
}

function handleRecordSelection(event) {
    const recordId = parseInt(event.target.dataset.recordId);
    const isChecked = event.target.checked;
    
    if (isChecked) {
        selectedRecords.add(recordId);
    } else {
        selectedRecords.delete(recordId);
    }
    
    updateRowSelection();
    updateSelectAllCheckbox();
    updateBatchOperationsVisibility();
}

function updateRowSelection() {
    // 更新表格行选中状态
    document.querySelectorAll('[data-record-id]').forEach(row => {
        const recordId = parseInt(row.dataset.recordId);
        if (selectedRecords.has(recordId)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.record-checkbox');
    const checkedCount = document.querySelectorAll('.record-checkbox:checked').length;
    
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
}

function updateBatchOperationsVisibility() {
    const batchOperations = document.getElementById('batchOperations');
    const selectedCount = document.getElementById('selectedCount');
    
    if (selectedRecords.size > 0) {
        batchOperations.style.display = 'flex';
        selectedCount.textContent = selectedRecords.size;
    } else {
        batchOperations.style.display = 'none';
    }
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = !selectAllCheckbox.checked;
        handleSelectAll({ target: selectAllCheckbox });
    }
}

function clearSelection() {
    selectedRecords.clear();
    document.querySelectorAll('.record-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateRowSelection();
    updateSelectAllCheckbox();
    updateBatchOperationsVisibility();
}

async function viewVoteRecord(recordId) {
    try {
        const response = await apiCall(`/api/admin/vote-records/${recordId}`);
        
        if (!response.ok) throw new Error('Failed to load vote record details');
        
        const result = await response.json();
        
        if (result.success) {
            showVoteRecordModal(result.record);
        } else {
            showError(result.message || '获取投票记录详情失败');
        }
        
    } catch (error) {
        console.error('View vote record error:', error);
        showError('获取投票记录详情失败');
    }
}

function showVoteRecordModal(record) {
    const modal = document.getElementById('voteRecordModal');
    const modalBody = document.getElementById('voteRecordModalBody');
    
    modalBody.innerHTML = `
        <div class="vote-detail-section">
            <h4><i class="fas fa-users"></i> 投票参与者</h4>
            <div class="detail-grid">
                <div class="participant-profile">
                    <img src="${record.voterAvatar || getDefaultAvatar(record.voterGender)}" 
                         alt="${record.voterName}" class="participant-avatar">
                    <div class="participant-info">
                        <h5>${record.voterName}</h5>
                        <p><i class="fas fa-${record.voterGender === 'male' ? 'mars' : 'venus'}"></i> 
                           ${record.voterGender === 'male' ? '男士' : '女士'} (投票者)</p>
                    </div>
                </div>
                <div class="participant-profile">
                    <img src="${record.candidateAvatar || getDefaultAvatar(record.candidateGender)}" 
                         alt="${record.candidateName}" class="participant-avatar">
                    <div class="participant-info">
                        <h5>${record.candidateName}</h5>
                        <p><i class="fas fa-${record.candidateGender === 'male' ? 'mars' : 'venus'}"></i> 
                           ${record.candidateGender === 'male' ? '男士' : '女士'} (被投票者)</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="vote-detail-section">
            <h4><i class="fas fa-info-circle"></i> 投票信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">投票时间</span>
                    <span class="detail-value">${formatDateTime(record.createdAt)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">投票状态</span>
                    <span class="detail-value">
                        <span class="vote-status ${record.status}">
                            <i class="fas fa-${record.status === 'active' ? 'check-circle' : 'times-circle'}"></i>
                            ${record.status === 'active' ? '有效投票' : '无效投票'}
                        </span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">投票方式</span>
                    <span class="detail-value">
                        <span class="vote-method ${record.voteMethod}">
                            <i class="fas fa-${record.voteMethod === 'qr_code' ? 'qrcode' : 'search'}"></i>
                            ${record.voteMethod === 'qr_code' ? '二维码投票' : '姓名搜索投票'}
                        </span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">最后更新</span>
                    <span class="detail-value">${formatDateTime(record.updatedAt)}</span>
                </div>
            </div>
        </div>
        
        <div class="vote-detail-section">
            <h4><i class="fas fa-network-wired"></i> 技术信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">IP地址</span>
                    <span class="detail-value">
                        <span class="ip-address">${record.ipAddress || 'N/A'}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">用户代理</span>
                    <span class="detail-value" style="font-size: 12px; word-break: break-all;">
                        ${record.userAgent || 'N/A'}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="modal-actions" style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
            ${record.status === 'active' ?
                `<button class="btn-warning" onclick="toggleVoteStatus('${record.id}', 'inactive')">
                    <i class="fas fa-ban"></i> 作废投票
                </button>` :
                `<button class="btn-success" onclick="toggleVoteStatus('${record.id}', 'active')">
                    <i class="fas fa-check"></i> 激活投票
                </button>`
            }
            <button class="btn-info" onclick="viewOperationHistory('${record.id}'); closeVoteRecordModal();">
                <i class="fas fa-history"></i> 操作历史
            </button>
            <button class="btn-secondary" onclick="closeVoteRecordModal()">关闭</button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeVoteRecordModal() {
    const modal = document.getElementById('voteRecordModal');
    modal.style.display = 'none';
}

async function toggleVoteStatus(recordId, newStatus) {
    console.log(`[toggleVoteStatus] 开始执行操作 - recordId: ${recordId}, newStatus: ${newStatus}`);

    // 防止重复调用
    if (window.isTogglingStatus) {
        console.warn('[toggleVoteStatus] 操作正在进行中,请勿重复点击');
        return;
    }

    // 先关闭所有现有的模态窗口,避免叠加
    console.log('[toggleVoteStatus] 先关闭所有现有的模态窗口');
    closeAllModals();

    const record = allVoteRecords.find(r => r.id == recordId);
    if (!record) {
        UXManager.feedback.show('error', '记录不存在', '找不到指定的投票记录');
        return;
    }

    const actionText = newStatus === 'active' ? '激活' : '作废';
    console.log(`[toggleVoteStatus] 准备显示确认对话框 - ${actionText}`);

    window.isTogglingStatus = true;

    try {
        const result = await UXManager.confirm.show({
            type: newStatus === 'active' ? 'info' : 'warning',
            title: `${actionText}投票记录`,
            message: `您即将${actionText}这条投票记录：${record.voterName} → ${record.candidateName}`,
            details: [
                `投票时间: ${formatDateTime(record.createdAt)}`,
                `当前状态: ${record.status === 'active' ? '有效' : '无效'}`,
                `投票方式: ${record.voteMethod === 'qr_code' ? '二维码' : '姓名搜索'}`
            ],
            requireReason: true,
            confirmText: `确认${actionText}`
        });

        if (result.confirmed) {
            await executeSingleStatusChange(recordId, newStatus, result.reason);
        }
    } finally {
        window.isTogglingStatus = false;
    }
}

async function executeSingleStatusChange(recordId, newStatus, reason) {
    const actionText = newStatus === 'active' ? '激活' : '作废';
    
    // 找到对应的按钮并显示加载状态
    const button = document.querySelector(`button[onclick*="toggleVoteStatus('${recordId}', '${newStatus}')"]`);
    if (button) {
        UXManager.loading.show(button, '处理中...');
    }
    
    try {
        const response = await apiCall(`/api/admin/vote-records/${recordId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                reason: reason
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            UXManager.feedback.show('success', '操作成功', 
                `投票记录已${actionText}`);
            
            // 更新本地数据
            const recordIndex = allVoteRecords.findIndex(r => r.id == recordId);
            if (recordIndex !== -1) {
                allVoteRecords[recordIndex].status = newStatus;
            }
            
            // 重新加载数据以确保统计正确
            await loadVoteRecords();
        } else {
            throw new Error(result.message || '操作失败');
        }
        
    } catch (error) {
        console.error('Toggle vote status error:', error);
        UXManager.feedback.show('error', '操作失败', 
            error.message || `${actionText}操作失败，请重试`);
    } finally {
        if (button) {
            UXManager.loading.hide(button);
        }
    }
}

async function viewOperationHistory(recordId) {
    try {
        const response = await fetch(`/api/admin/vote-records/${recordId}/history`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load operation history');
        
        const result = await response.json();
        
        if (result.success) {
            showOperationHistoryModal(recordId, result.history || []);
        } else {
            showError(result.message || '获取操作历史失败');
        }
        
    } catch (error) {
        console.error('View operation history error:', error);
        showError('获取操作历史失败');
    }
}

function showOperationHistoryModal(recordId, history) {
    const modal = document.getElementById('voteRecordModal');
    const modalBody = document.getElementById('voteRecordModalBody');
    
    modalBody.innerHTML = `
        <div class="vote-detail-section">
            <h4><i class="fas fa-history"></i> 操作历史</h4>
            <div class="operation-history">
                ${history.length > 0 ? history.map(item => `
                    <div class="history-item">
                        <div class="history-icon ${item.operation}">
                            <i class="fas fa-${item.operation === 'activate' ? 'check' : 'ban'}"></i>
                        </div>
                        <div class="history-content">
                            <div class="history-action">
                                ${item.operation === 'activate' ? '激活投票' : '作废投票'}
                            </div>
                            <div class="history-time">
                                ${formatDateTime(item.createdAt)} - 操作员: ${item.adminName || '系统'}
                            </div>
                            ${item.reason ? `<div class="history-reason">"${item.reason}"</div>` : ''}
                        </div>
                    </div>
                `).join('') : '<p style="text-align: center; color: #6c757d; font-style: italic;">暂无操作历史</p>'}
            </div>
        </div>
        
        <div class="modal-actions" style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn-secondary" onclick="closeVoteRecordModal()">关闭</button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

async function showBatchConfirm(action) {
    if (selectedRecords.size === 0) {
        UXManager.feedback.show('warning', '未选择记录', '请先选择要操作的记录');
        return;
    }
    
    const actionText = action === 'activate' ? '激活' : '作废';
    const selectedCount = selectedRecords.size;
    
    // 获取选中记录的详细信息
    const selectedRecordDetails = allVoteRecords
        .filter(record => selectedRecords.has(record.id))
        .map(record => `${record.voterName} → ${record.candidateName}`);
    
    const result = await UXManager.confirm.show({
        type: action === 'activate' ? 'info' : 'warning',
        title: `批量${actionText}确认`,
        message: `您即将${actionText} ${selectedCount} 条投票记录。此操作将影响投票统计结果，请谨慎操作。`,
        details: selectedRecordDetails.slice(0, 5).concat(
            selectedRecordDetails.length > 5 ? [`...还有 ${selectedRecordDetails.length - 5} 条记录`] : []
        ),
        requireReason: true,
        confirmText: `确认${actionText}`
    });
    
    if (result.confirmed) {
        await executeBatchAction(action, result.reason);
    }
}

async function executeBatchAction(action, reason) {
    const recordCount = selectedRecords.size;
    const actionText = action === 'activate' ? '激活' : '作废';
    
    // 显示进度反馈
    const feedbackId = UXManager.feedback.show('info', '批量操作进行中', `正在${actionText} ${recordCount} 条记录...`, 0);
    UXManager.progress.show();
    
    try {
        UXManager.progress.update(20);
        
        const response = await apiCall('/api/admin/vote-records/batch-status', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voteIds: Array.from(selectedRecords),
                status: action === 'activate' ? 'active' : 'inactive',
                reason: reason
            })
        });
        
        UXManager.progress.update(60);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        UXManager.progress.update(80);
        
        if (result.success) {
            const updatedCount = result.data?.updatedCount || result.updatedCount || selectedRecords.size;
            const failedCount = recordCount - updatedCount;
            
            // 清空选择
            clearSelection();
            
            // 重新加载数据
            await loadVoteRecords();
            
            UXManager.progress.update(100);
            
            // 显示成功反馈
            UXManager.feedback.hide(feedbackId);
            
            if (failedCount === 0) {
                UXManager.feedback.show('success', '批量操作成功', 
                    `成功${actionText}了 ${updatedCount} 条投票记录`);
            } else {
                UXManager.feedback.show('warning', '批量操作部分成功', 
                    `成功${actionText}了 ${updatedCount} 条记录，${failedCount} 条记录操作失败`);
            }
            
        } else {
            throw new Error(result.message || `批量${actionText}操作失败`);
        }
        
    } catch (error) {
        console.error('Batch action error:', error);
        UXManager.feedback.hide(feedbackId);
        UXManager.feedback.show('error', '批量操作失败',
            error.message || `批量${actionText}操作失败，请重试`);
    } finally {
        UXManager.progress.hide();
    }
}

function closeBatchConfirmModal() {
    const modal = document.getElementById('batchConfirmModal');
    modal.style.display = 'none';
}

function showExportModal() {
    const modal = document.getElementById('exportModal');
    updateExportPreview();
    modal.style.display = 'flex';
    
    // 添加表单变化监听器
    const form = document.getElementById('exportForm');
    form.addEventListener('change', updateExportPreview);
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    const form = document.getElementById('exportForm');
    const exportProgress = document.getElementById('exportProgress');
    
    // 重置表单和进度
    form.reset();
    exportProgress.style.display = 'none';
    
    // 重新选中默认字段
    const defaultFields = ['voter_name', 'candidate_name', 'vote_time', 'status', 'vote_method'];
    defaultFields.forEach(field => {
        const checkbox = form.querySelector(`input[name="fields"][value="${field}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    modal.style.display = 'none';
}

function updateExportPreview() {
    const form = document.getElementById('exportForm');
    const formData = new FormData(form);
    const exportSummary = document.getElementById('exportSummary');
    const currentFilterCount = document.getElementById('currentFilterCount');
    
    // 更新当前筛选结果数量显示
    if (currentFilterCount) {
        const hasFilters = Object.keys(currentFilters).length > 0;
        if (hasFilters) {
            currentFilterCount.textContent = `(约 ${totalRecords} 条记录)`;
        } else {
            currentFilterCount.textContent = `(所有记录)`;
        }
    }
    
    // 获取选择的字段
    const selectedFields = formData.getAll('fields');
    const exportRange = formData.get('exportRange');
    const exportFormat = formData.get('format');
    
    // 更新预览信息
    const previewRecordCount = document.getElementById('previewRecordCount');
    const previewFieldCount = document.getElementById('previewFieldCount');
    const previewFormat = document.getElementById('previewFormat');
    
    if (previewRecordCount) {
        const recordCount = exportRange === 'current' ? totalRecords : '全部';
        previewRecordCount.textContent = recordCount;
    }
    
    if (previewFieldCount) {
        previewFieldCount.textContent = selectedFields.length;
    }
    
    if (previewFormat) {
        previewFormat.textContent = exportFormat === 'csv' ? 'CSV' : 'Excel';
    }
    
    // 显示预览信息
    if (selectedFields.length > 0) {
        exportSummary.style.display = 'block';
    } else {
        exportSummary.style.display = 'none';
    }
}

function showExportHistory() {
    const history = JSON.parse(localStorage.getItem('export_history') || '[]');
    
    if (history.length === 0) {
        showInfo('暂无导出历史记录');
        return;
    }
    
    const historyHtml = history.map(item => `
        <div class="export-history-item" style="padding: 12px; border: 1px solid #e9ecef; border-radius: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${item.filename}</strong>
                    <small style="color: #6c757d; display: block;">
                        ${item.recordCount} 条记录 • ${item.format.toUpperCase()} 格式 • ${formatDateTime(item.createdAt)}
                    </small>
                </div>
                <button onclick="downloadExportFile('${item.taskId}', '${item.filename}')" 
                        class="btn-sm btn-outline-primary" style="font-size: 12px;">
                    <i class="fas fa-download"></i> 重新下载
                </button>
            </div>
        </div>
    `).join('');
    
    // 这里可以显示在一个模态框中，但为了简化，我们使用alert
    // 在实际应用中，应该创建一个专门的历史记录模态框
    console.log('Export History:', history);
    showInfo(`找到 ${history.length} 条导出历史记录，请查看控制台`);
}

function handleExportSuccess(result) {
    const data = result.data;
    
    // 显示详细的成功信息
    const successMessage = `
        导出完成！
        • 记录数量: ${data.recordCount} 条
        • 文件大小: ${formatFileSize(data.fileSize)}
        • 导出格式: ${data.format.toUpperCase()}
    `;
    
    showSuccess(successMessage);
    
    // 记录导出操作到本地存储（用于历史记录）
    const exportHistory = JSON.parse(localStorage.getItem('export_history') || '[]');
    exportHistory.unshift({
        taskId: data.taskId,
        filename: data.filename,
        recordCount: data.recordCount,
        format: data.format,
        createdAt: data.createdAt,
        timestamp: new Date().toISOString()
    });
    
    // 只保留最近10次导出记录
    if (exportHistory.length > 10) {
        exportHistory.splice(10);
    }
    
    localStorage.setItem('export_history', JSON.stringify(exportHistory));
    
    return data;
}

function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function validateExportParameters(formData) {
    const selectedFields = formData.getAll('fields');
    const exportFormat = formData.get('format');
    const exportRange = formData.get('exportRange');
    
    // 验证字段选择
    if (selectedFields.length === 0) {
        return { valid: false, message: '请至少选择一个导出字段' };
    }
    
    // 验证导出格式
    if (!['csv', 'excel'].includes(exportFormat)) {
        return { valid: false, message: '请选择有效的导出格式' };
    }
    
    // 验证导出范围
    if (!['current', 'all'].includes(exportRange)) {
        return { valid: false, message: '请选择有效的导出范围' };
    }
    
    // 检查是否有数据可导出
    if (exportRange === 'current' && totalRecords === 0) {
        return { valid: false, message: '当前筛选条件下没有数据可以导出' };
    }
    
    return { valid: true };
}

async function startExport() {
    const form = document.getElementById('exportForm');
    const formData = new FormData(form);
    const startBtn = document.getElementById('startExportBtn');
    const exportProgress = document.getElementById('exportProgress');
    const originalText = startBtn.innerHTML;
    
    // 验证导出参数
    const validation = validateExportParameters(formData);
    if (!validation.valid) {
        showError(validation.message);
        return;
    }
    
    const selectedFields = formData.getAll('fields');
    
    // 显示进度指示
    exportProgress.style.display = 'block';
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导出中...';
    
    // 模拟进度条动画
    const progressFill = exportProgress.querySelector('.progress-fill');
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 90) progress = 90;
        progressFill.style.width = progress + '%';
    }, 200);
    
    try {
        // 构建导出数据
        const exportData = {
            format: formData.get('format'),
            filters: formData.get('exportRange') === 'current' ? currentFilters : {},
            columns: selectedFields
        };
        
        const response = await fetch('/api/admin/export/vote-records', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        });
        
        if (!response.ok) {
            const errorResult = await response.json();
            
            // 处理不同的错误类型
            switch (errorResult.errorCode) {
                case 'INVALID_FORMAT':
                    throw new Error('导出格式无效，请选择CSV或Excel格式');
                case 'NO_DATA_TO_EXPORT':
                    throw new Error('没有符合条件的数据可以导出');
                case 'EXPORT_FAILED':
                    throw new Error('导出失败：' + (errorResult.error || '未知错误'));
                default:
                    throw new Error(errorResult.message || 'Failed to create export');
            }
        }
        
        const result = await response.json();
        
        if (result.success) {
            // 完成进度条
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            
            const exportData = handleExportSuccess(result);
            
            // 延迟一下再关闭模态框和下载文件
            setTimeout(() => {
                closeExportModal();
                downloadExportFile(exportData.taskId, exportData.filename);
            }, 1000);
        } else {
            throw new Error(result.message || '创建导出任务失败');
        }
        
    } catch (error) {
        console.error('Start export error:', error);
        clearInterval(progressInterval);
        showError(error.message || '导出失败，请重试');
        exportProgress.style.display = 'none';
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = originalText;
    }
}

async function downloadExportFile(taskId, filename) {
    try {
        showInfo('正在准备下载文件...');
        
        const response = await fetch(`/api/admin/export/${taskId}/download`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const errorResult = await response.json();
            
            // 处理不同的错误类型
            switch (errorResult.errorCode) {
                case 'TASK_NOT_FOUND':
                    throw new Error('导出任务不存在，可能已被清理');
                case 'TASK_EXPIRED':
                    throw new Error('导出文件已过期，请重新导出');
                case 'FILE_NOT_FOUND':
                    throw new Error('导出文件不存在，请重新导出');
                default:
                    throw new Error(errorResult.message || 'Failed to download export file');
            }
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `vote-records-${new Date().toISOString().split('T')[0]}.${response.headers.get('content-type').includes('excel') ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('文件下载完成');
        
    } catch (error) {
        console.error('Download export file error:', error);
        showError(error.message || '下载文件失败');
        
        // 如果下载失败，提供重新导出的选项
        if (error.message.includes('过期') || error.message.includes('不存在')) {
            setTimeout(() => {
                if (confirm('文件可能已过期或不存在，是否重新打开导出对话框？')) {
                    showExportModal();
                }
            }, 2000);
        }
    }
}

// 设置导出表单事件
document.addEventListener('DOMContentLoaded', function() {
    const startExportBtn = document.getElementById('startExportBtn');
    if (startExportBtn) {
        startExportBtn.addEventListener('click', startExport);
    }
});

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// 点击模态框外部关闭
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// 工具函数
function getDefaultAvatar(gender) {
    return gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg';
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
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

function logout() {
    // 使用认证管理器处理登出
    auth.logout();
}

async function logoutFromServer() {
    // 这个函数现在由认证管理器的logout方法处理
    // 保留以保持兼容性
    return await auth.logout();
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