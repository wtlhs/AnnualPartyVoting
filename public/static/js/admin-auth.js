/**
 * 管理员认证和权限控制工具
 * 用于所有管理后台页面的统一认证管理
 */

class AdminAuth {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.sessionCheckInterval = null;
        this.sessionRefreshTimeout = null;
        this.isValidating = false;
    }

    /**
     * 检查管理员认证状态
     * @param {boolean} redirectOnFail - 认证失败时是否重定向到登录页
     * @returns {boolean} 是否已认证
     */
    isAuthenticated(redirectOnFail = true) {
        if (!this.token) {
            if (redirectOnFail) {
                this.redirectToLogin('未登录，请先登录');
            }
            return false;
        }
        return true;
    }

    /**
     * 验证会话有效性
     * @returns {Promise<boolean>} 会话是否有效
     */
    async validateSession() {
        if (this.isValidating) {
            return false;
        }

        if (!this.token) {
            return false;
        }

        this.isValidating = true;

        try {
            const response = await fetch('/api/admin/session', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.handleSessionExpired();
                    return false;
                }
                throw new Error(`Session validation failed: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.session) {
                // 会话有效，设置自动刷新
                this.scheduleSessionRefresh(result.session.remainingTime);
                return true;
            } else {
                this.handleSessionExpired();
                return false;
            }

        } catch (error) {
            console.error('Session validation error:', error);
            
            // 网络错误时不强制登出，但记录错误
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn('Network error during session validation, keeping session');
                return true; // 假设会话仍然有效
            }
            
            this.handleSessionExpired();
            return false;
        } finally {
            this.isValidating = false;
        }
    }

    /**
     * 处理会话过期
     */
    handleSessionExpired() {
        this.clearSession();
        this.showMessage('会话已过期，请重新登录', 'error');
        
        setTimeout(() => {
            this.redirectToLogin();
        }, 2000);
    }

    /**
     * 清理会话数据
     */
    clearSession() {
        localStorage.removeItem('admin_token');
        this.token = null;
        
        // 清理定时器
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        
        if (this.sessionRefreshTimeout) {
            clearTimeout(this.sessionRefreshTimeout);
            this.sessionRefreshTimeout = null;
        }
    }

    /**
     * 安排会话刷新
     * @param {number} remainingTime - 剩余时间（毫秒）
     */
    scheduleSessionRefresh(remainingTime) {
        // 清理现有的刷新计划
        if (this.sessionRefreshTimeout) {
            clearTimeout(this.sessionRefreshTimeout);
        }

        // 在会话过期前5分钟刷新会话
        const refreshTime = Math.max(remainingTime - 5 * 60 * 1000, 60 * 1000);
        
        this.sessionRefreshTimeout = setTimeout(() => {
            this.validateSession();
        }, refreshTime);
    }

    /**
     * 启动定期会话检查
     * @param {number} interval - 检查间隔（毫秒），默认5分钟
     */
    startSessionMonitoring(interval = 5 * 60 * 1000) {
        // 清理现有的监控
        this.stopSessionMonitoring();
        
        // 立即验证一次
        this.validateSession();
        
        // 设置定期检查
        this.sessionCheckInterval = setInterval(() => {
            this.validateSession();
        }, interval);
    }

    /**
     * 停止会话监控
     */
    stopSessionMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        
        if (this.sessionRefreshTimeout) {
            clearTimeout(this.sessionRefreshTimeout);
            this.sessionRefreshTimeout = null;
        }
    }

    /**
     * 重定向到登录页面
     * @param {string} message - 提示消息
     */
    redirectToLogin(message = '') {
        if (message) {
            this.showMessage(message, 'info');
        }
        
        setTimeout(() => {
            window.location.href = '/admin';
        }, message ? 1500 : 0);
    }

    /**
     * 管理员登出
     * @returns {Promise<boolean>} 登出是否成功
     */
    async logout() {
        if (!confirm('确定要退出登录吗？')) {
            return false;
        }

        try {
            // 调用服务器端登出API
            if (this.token) {
                const response = await fetch('/api/admin/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    this.showMessage('已退出登录', 'success');
                } else {
                    this.showMessage('已退出登录（本地）', 'success');
                }
            }

        } catch (error) {
            console.error('Logout error:', error);
            this.showMessage('已退出登录（本地）', 'success');
        } finally {
            // 无论服务器响应如何，都清理本地状态
            this.clearSession();
            
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1500);
        }

        return true;
    }

    /**
     * 创建带认证的API调用包装器
     * @param {string} url - API URL
     * @param {object} options - fetch选项
     * @returns {Promise<Response>} fetch响应
     */
    async apiCall(url, options = {}) {
        if (!this.token) {
            throw new Error('No authentication token available');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, { ...options, headers: defaultOptions.headers });

        // 处理认证错误
        if (response.status === 401) {
            this.handleSessionExpired();
            throw new Error('Authentication failed');
        }

        return response;
    }

    /**
     * 获取当前认证令牌
     * @returns {string|null} 认证令牌
     */
    getToken() {
        return this.token;
    }

    /**
     * 设置认证令牌
     * @param {string} token - 认证令牌
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('admin_token', token);
    }

    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, info, warning)
     */
    showMessage(message, type = 'info') {
        // 移除现有消息
        const existingMessage = document.querySelector('.admin-auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageDiv = document.createElement('div');
        messageDiv.className = `admin-auth-message ${type}-message`;
        
        const iconMap = {
            error: 'fas fa-exclamation-circle',
            success: 'fas fa-check-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };

        messageDiv.innerHTML = `
            <i class="${iconMap[type] || iconMap.info}"></i>
            <span>${message}</span>
        `;

        // 添加样式
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 400px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
        `;

        // 设置背景颜色
        const colorMap = {
            error: '#dc3545',
            success: '#28a745',
            info: '#17a2b8',
            warning: '#ffc107'
        };
        messageDiv.style.backgroundColor = colorMap[type] || colorMap.info;

        // 插入到页面
        document.body.appendChild(messageDiv);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }
        }, 3000);
    }

    /**
     * 初始化管理员认证
     * 应在每个管理页面加载时调用
     */
    init() {
        // 检查认证状态
        if (!this.isAuthenticated()) {
            return false;
        }

        // 启动会话监控
        this.startSessionMonitoring();

        // 设置全局错误处理
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message === 'Authentication failed') {
                event.preventDefault(); // 防止控制台错误
            }
        });

        // 页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            this.stopSessionMonitoring();
        });

        return true;
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 创建全局实例
window.adminAuth = new AdminAuth();

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminAuth;
}