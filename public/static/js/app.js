// 主页面 JavaScript
// 页面加载优化
class PageLoadOptimizer {
    constructor() {
        this.loadingBar = null;
        this.loadStartTime = Date.now();
        this.init();
    }
    
    init() {
        this.createLoadingBar();
        this.setupPerformanceMonitoring();
        this.preloadCriticalResources();
        this.optimizeImages();
    }
    
    createLoadingBar() {
        this.loadingBar = document.createElement('div');
        this.loadingBar.className = 'page-loading-bar';
        this.loadingBar.innerHTML = '<div></div>';
        document.body.appendChild(this.loadingBar);
    }
    
    showLoadingBar() {
        if (this.loadingBar) {
            this.loadingBar.classList.add('active');
        }
    }
    
    hideLoadingBar() {
        if (this.loadingBar) {
            setTimeout(() => {
                this.loadingBar.classList.remove('active');
            }, 300);
        }
    }
    
    setupPerformanceMonitoring() {
        // 监控页面加载性能
        window.addEventListener('load', () => {
            const loadTime = Date.now() - this.loadStartTime;
            console.log(`Page loaded in ${loadTime}ms`);
            
            // 如果加载时间超过3秒，显示提示
            if (loadTime > 3000) {
                this.showSlowLoadingTip();
            }
        });
    }
    
    preloadCriticalResources() {
        // 预加载关键资源
        const criticalResources = [
            '/static/css/style.css',
            '/static/js/app.js'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    }
    
    optimizeImages() {
        // 图片懒加载和优化
        const images = document.querySelectorAll('img[data-src]');
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('skeleton');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // 降级处理
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('skeleton');
            });
        }
    }
    
    showSlowLoadingTip() {
        const tip = document.createElement('div');
        tip.className = 'loading-message';
        tip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="loading-spinner"></div>
                <span>网络较慢，正在优化加载...</span>
            </div>
        `;
        document.body.appendChild(tip);
        
        setTimeout(() => {
            if (tip.parentNode) {
                tip.remove();
            }
        }, 5000);
    }
    
    // 显示骨架屏
    showSkeleton(container) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-container';
        skeleton.innerHTML = `
            <div class="skeleton skeleton-text large"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text small"></div>
            <div class="skeleton skeleton-button"></div>
        `;
        container.appendChild(skeleton);
        return skeleton;
    }
    
    // 隐藏骨架屏
    hideSkeleton(skeleton) {
        if (skeleton && skeleton.parentNode) {
            skeleton.classList.add('fade-out');
            setTimeout(() => {
                skeleton.remove();
            }, 300);
        }
    }
}

// 初始化页面加载优化器
const pageOptimizer = new PageLoadOptimizer();

document.addEventListener('DOMContentLoaded', function() {
    // 添加渐入动画
    const elements = document.querySelectorAll('header, main, .actions');
    elements.forEach((el, index) => {
        el.classList.add('fade-in', `delay-${index + 1}`);
    });
    
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        // 显示加载条
        pageOptimizer.showLoadingBar();
        
        // 新增：检查return参数
        checkReturnParameter();
        
        // 检查是否已经注册过
        checkExistingRegistration();
        registerForm.addEventListener('submit', handleRegistration);
        
        // 隐藏加载条
        setTimeout(() => {
            pageOptimizer.hideLoadingBar();
        }, 500);
    }
});

// 本地缓存键名
const STORAGE_KEYS = {
    USER_ID: 'annual_party_user_id',
    USER_NAME: 'annual_party_user_name',
    USER_GENDER: 'annual_party_user_gender',
    NUMERIC_ID: 'annual_party_numeric_id',
    REGISTRATION_TIME: 'annual_party_registration_time',
    // 新增：投票意图相关的存储键
    PENDING_RETURN_URL: 'pending_return_url',
    VOTE_INTENT_TIMESTAMP: 'vote_intent_timestamp'
};

function checkExistingRegistration() {
    const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    const userName = localStorage.getItem(STORAGE_KEYS.USER_NAME);
    const registrationTime = localStorage.getItem(STORAGE_KEYS.REGISTRATION_TIME);
    
    if (userId && userName && registrationTime) {
        // 使用统一的注册验证函数
        if (isRegistrationValid(registrationTime)) {
            showExistingRegistrationMessage(userName, userId);
            return true;
        } else {
            // 清除过期的缓存
            clearRegistrationCache();
        }
    }
    
    return false;
}

function showExistingRegistrationMessage(userName, userId) {
    const form = document.getElementById('registerForm');
    const container = form.parentNode;
    
    // 隐藏注册表单
    form.style.display = 'none';
    
    // 隐藏性别选择重要提醒
    const genderWarning = document.querySelector('.gender-selection-warning');
    if (genderWarning) {
        genderWarning.style.display = 'none';
    }
    
    // 显示投票按钮
    showVotingActions();
    
    // 显示已注册信息
    const numericId = localStorage.getItem(STORAGE_KEYS.NUMERIC_ID);
    const existingDiv = document.createElement('div');
    existingDiv.className = 'existing-registration';
    existingDiv.innerHTML = `
        <div class="existing-info">
            <h3>您已经注册过了</h3>
            <p>姓名: <strong>${userName}</strong></p>
            ${numericId ? `<p>数字ID: <strong>${numericId}</strong></p>` : ''}
            <p>注册时间: ${new Date(localStorage.getItem(STORAGE_KEYS.REGISTRATION_TIME)).toLocaleString('zh-CN')}</p>
            <div class="existing-actions">
                <a href="/profile/${userId}" class="btn-primary">查看我的资料</a>
                <button id="reregister-btn" class="btn-secondary">重新注册</button>
            </div>
        </div>
    `;
    
    container.insertBefore(existingDiv, form);
    
    // 添加重新注册按钮的事件监听器
    const reregisterBtn = document.getElementById('reregister-btn');
    if (reregisterBtn) {
        reregisterBtn.addEventListener('click', clearRegistrationAndReload);
    }
}

function clearRegistrationAndReload() {
    if (confirm('确定要清除当前注册信息并重新注册吗？这将删除您的所有账号数据（包括投票记录）。')) {
        const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
        
        // 立即清除本地缓存，防止页面跳转后仍然显示已注册状态
        clearRegistrationCache();
        
        if (userId) {
            // 调用后端API删除用户数据
            deleteUserAccount(userId);
        } else {
            // 如果没有用户ID，直接跳转到首页
            window.location.href = '/';
        }
    }
}

async function deleteUserAccount(userId) {
    try {
        // 显示删除中的提示
        showMessage('正在删除账号数据...', 'info');
        
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 本地缓存已经在调用前清除，直接显示成功消息并跳转
            showMessage('账号数据已删除，正在返回首页...', 'success');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            // 如果后端删除失败，仍然跳转到首页（本地缓存已清除）
            console.error('Backend deletion failed:', result.message);
            showMessage('本地数据已清除，正在返回首页...', 'success');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }
    } catch (error) {
        console.error('Delete user account error:', error);
        
        ErrorHandler.handleNetworkError(error, {
            context: 'User account deletion',
            retryAction: () => deleteUserAccount(userId),
            userId: userId
        });
        
        // 网络错误时，本地缓存已清除，直接跳转到首页
        showMessage('本地数据已清除，正在返回首页...', 'success');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
}

function clearRegistrationCache() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (error) {
        console.error('Error clearing registration cache:', error);
        ErrorHandler.handleStorageError(error, null, { 
            context: 'Clearing registration cache',
            keys: Object.values(STORAGE_KEYS)
        });
    }
}

// 新增：检查并处理return参数
function checkReturnParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('return');
    
    if (returnUrl) {
        // 保存return URL到本地存储
        localStorage.setItem(STORAGE_KEYS.PENDING_RETURN_URL, returnUrl);
        localStorage.setItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP, new Date().toISOString());
        
        // 显示投票相关的注册提示
        showVoteRegistrationPrompt(returnUrl);
    }
}

// 新增：显示投票注册提示
function showVoteRegistrationPrompt(returnUrl) {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'vote-registration-prompt';
    promptDiv.innerHTML = `
        <div class="prompt-content">
            <div class="prompt-icon">🗳️</div>
            <h3>投票前需要注册</h3>
            <p>您需要先注册才能参与投票，注册完成后将自动返回投票页面。</p>
            <div class="prompt-actions">
                <button class="btn-primary" onclick="scrollToRegistrationForm()">立即注册</button>
                <button class="btn-secondary" onclick="dismissVotePrompt()">稍后再说</button>
            </div>
        </div>
    `;
    
    // 插入到注册表单前
    const form = document.getElementById('registerForm');
    if (form) {
        form.parentNode.insertBefore(promptDiv, form);
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .vote-registration-prompt {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                animation: slideInDown 0.5s ease-out;
            }
            
            .prompt-content {
                text-align: center;
            }
            
            .prompt-icon {
                font-size: 2.5em;
                margin-bottom: 10px;
            }
            
            .vote-registration-prompt h3 {
                margin: 0 0 10px 0;
                font-size: 1.4em;
                font-weight: 600;
            }
            
            .vote-registration-prompt p {
                margin: 0 0 20px 0;
                opacity: 0.9;
                line-height: 1.5;
            }
            
            .prompt-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .prompt-actions .btn-primary,
            .prompt-actions .btn-secondary {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .prompt-actions .btn-primary {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .prompt-actions .btn-primary:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }
            
            .prompt-actions .btn-secondary {
                background: transparent;
                color: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .prompt-actions .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            
            @keyframes slideInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes slideOutUp {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-20px);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 新增：滚动到注册表单
function scrollToRegistrationForm() {
    const form = document.getElementById('registerForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 聚焦到姓名输入框
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 500);
        }
    }
}

// 新增：关闭投票提示
function dismissVotePrompt() {
    const prompt = document.querySelector('.vote-registration-prompt');
    if (prompt) {
        prompt.style.animation = 'slideOutUp 0.3s ease-in';
        setTimeout(() => {
            prompt.remove();
        }, 300);
    }
    
    // 清除待处理的返回URL
    localStorage.removeItem(STORAGE_KEYS.PENDING_RETURN_URL);
    localStorage.removeItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);
}

// 新增：验证投票意图的有效性
function isVoteIntentValid(timestamp) {
    if (!timestamp) return false;
    
    const intentTime = new Date(timestamp);
    const now = new Date();
    const hoursDiff = (now - intentTime) / (1000 * 60 * 60);
    
    // 24小时内的投票意图被认为是有效的
    return hoursDiff < 24;
}

// 新增：验证注册信息的有效性
function isRegistrationValid(registrationTime) {
    if (!registrationTime) return false;
    
    const regTime = new Date(registrationTime);
    const now = new Date();
    const hoursDiff = (now - regTime) / (1000 * 60 * 60);
    
    // 24小时内的注册被认为是有效的
    return hoursDiff < 24;
}

function showVotingActions() {
    const actionsDiv = document.getElementById('mainActions');
    if (actionsDiv) {
        actionsDiv.style.display = 'flex';
    }
}

async function handleRegistration(event) {
    event.preventDefault();
    
    // 再次检查是否已注册（防止并发注册）
    if (checkExistingRegistration()) {
        return;
    }
    
    const formData = new FormData(event.target);
    const name = formData.get('name').trim();
    const gender = formData.get('gender');
    
    // 基本验证
    if (!name) {
        showMessage('请输入姓名', 'error');
        return;
    }
    
    if (name.length > 20) {
        showMessage('姓名长度不能超过20个字符', 'error');
        return;
    }
    
    if (!gender) {
        showMessage('请选择性别', 'error');
        return;
    }
    
    // 检查姓名是否包含特殊字符
    if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(name)) {
        showMessage('姓名只能包含中文、英文字母和空格', 'error');
        return;
    }
    
    // 禁用提交按钮防止重复提交
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';
    
    // 显示性别确认模态框
    showGenderConfirmationModal(name, gender, submitBtn, originalText);
    return; // 在模态框中处理后续逻辑
}

function showMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
    messageDiv.textContent = message;
    
    // 插入到表单前面
    const form = document.getElementById('registerForm');
    const container = form.parentNode;
    container.insertBefore(messageDiv, form);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// 性别确认模态框相关函数
let currentRegistrationData = null;
let currentSubmitBtn = null;
let currentSubmitBtnText = '';

function showGenderConfirmationModal(name, gender, submitBtn, originalText) {
    currentRegistrationData = { name, gender };
    currentSubmitBtn = submitBtn;
    currentSubmitBtnText = originalText;
    
    // 设置确认信息
    document.getElementById('confirmName').textContent = name;
    document.getElementById('confirmGender').textContent = gender === 'male' ? '男' : '女';
    
    // 设置模态框中的性别选择
    const modalGenderRadios = document.querySelectorAll('input[name="modalGender"]');
    modalGenderRadios.forEach(radio => {
        radio.checked = radio.value === gender;
    });
    
    // 初始化样式
    const infoSummary = document.querySelector('.gender-confirmation .info-summary');
    if (infoSummary) {
        infoSummary.classList.remove('male', 'female');
        infoSummary.classList.add(gender);
    }
    
    // 显示模态框
    const modal = document.getElementById('genderConfirmationModal');
    modal.classList.add('active');
    
    // 添加事件监听器，实时更新显示的性别
    modalGenderRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const newGender = this.value;
            document.getElementById('confirmGender').textContent = newGender === 'male' ? '男' : '女';
            currentRegistrationData.gender = newGender;
            
            // 更新样式
            if (infoSummary) {
                infoSummary.classList.remove('male', 'female');
                infoSummary.classList.add(newGender);
                
                // 添加数值跳动动画效果
                const values = infoSummary.querySelectorAll('.info-value');
                values.forEach(val => {
                    val.style.transform = 'scale(1.15)';
                    setTimeout(() => val.style.transform = 'scale(1)', 300);
                });
            }
        });
    });
}

function closeGenderModal() {
    const modal = document.getElementById('genderConfirmationModal');
    modal.classList.remove('active');
    currentRegistrationData = null;
    
    // 恢复提交按钮状态
    if (currentSubmitBtn) {
        currentSubmitBtn.disabled = false;
        currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
        currentSubmitBtn = null;
        currentSubmitBtnText = '';
    }
}

async function confirmGender() {
    if (!currentRegistrationData) return;

    // 关闭模态框
    const modal = document.getElementById('genderConfirmationModal');
    modal.classList.remove('active');

    // 确保按钮处于加载状态
    if (currentSubmitBtn) {
        currentSubmitBtn.disabled = true;
        currentSubmitBtn.textContent = '注册中...';
    }

    try {
        const { name, gender } = currentRegistrationData;

        // 新增：花名册校验
        const validationResult = await validateRoster(name, gender);
        if (!validationResult.valid) {
            // 显示花名册警告模态框
            showRosterWarningModal(validationResult.message);
            // 不要清空数据，让用户可以选择继续注册
            return; // 等待用户选择
        }

        // Get current base URL from browser
        const currentBaseURL = `${window.location.protocol}//${window.location.host}`;

        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name, 
                gender,
                baseURL: currentBaseURL
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 保存注册信息到本地缓存
            localStorage.setItem(STORAGE_KEYS.USER_ID, result.userId);
            localStorage.setItem(STORAGE_KEYS.USER_NAME, result.name);
            localStorage.setItem(STORAGE_KEYS.USER_GENDER, result.gender);
            localStorage.setItem(STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

            // 保存数字ID
            if (result.numericId) {
                localStorage.setItem(STORAGE_KEYS.NUMERIC_ID, result.numericId);
            }

            // 清空注册数据
            currentRegistrationData = null;
            if (currentSubmitBtn) {
                currentSubmitBtn.disabled = false;
                currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
                currentSubmitBtn = null;
                currentSubmitBtnText = '';
            }
            
            // 新增：检查是否有待处理的返回URL
            const pendingReturnUrl = localStorage.getItem(STORAGE_KEYS.PENDING_RETURN_URL);
            const voteIntentTimestamp = localStorage.getItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);
            
            if (pendingReturnUrl && isVoteIntentValid(voteIntentTimestamp)) {
                // 清除待处理的返回URL
                localStorage.removeItem(STORAGE_KEYS.PENDING_RETURN_URL);
                localStorage.removeItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);
                
                showMessage(`注册成功！您的数字ID是：${result.numericId}。正在返回投票页面...`, 'success');
                
                // 显示投票按钮
                showVotingActions();
                
                setTimeout(() => {
                    window.location.href = pendingReturnUrl;
                }, 1500);
                return;
            }
            
            // 默认行为：跳转到个人页面
            showMessage(`注册成功！您的数字ID是：${result.numericId}。正在跳转到个人页面...`, 'success');

            // 显示投票按钮
            showVotingActions();

            setTimeout(() => {
                window.location.href = `/profile/${result.userId}`;
            }, 2000);
        } else {
            // 处理特定错误
            if (result.errorCode === 'NAME_ALREADY_EXISTS') {
                showNameConflictDialog(currentRegistrationData.name, currentRegistrationData.gender);
            } else {
                showMessage(result.message || '注册失败，请重试', 'error');
            }

            // 清空注册数据
            currentRegistrationData = null;
            if (currentSubmitBtn) {
                currentSubmitBtn.disabled = false;
                currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
                currentSubmitBtn = null;
                currentSubmitBtnText = '';
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        ErrorHandler.handleNetworkError(error, {
            context: 'User registration',
            retryAction: () => confirmGender(),
            registrationData: currentRegistrationData
        });
        // 发生错误时也要清空数据
        currentRegistrationData = null;
        if (currentSubmitBtn) {
            currentSubmitBtn.disabled = false;
            currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
            currentSubmitBtn = null;
            currentSubmitBtnText = '';
        }
    }
    // 注意：校验失败时不执行 finally，保留 currentRegistrationData 供 proceedAsGuest 使用
}

// 姓名冲突处理函数
function showNameConflictDialog(name, gender) {
    const modal = document.getElementById('nameConflictModal');
    if (!modal) {
        // 如果模态框不存在，回退到普通消息提示
        showMessage(`姓名 "${name}" 已被注册，请使用其他姓名`, 'error');
        return;
    }
    
    // 设置冲突的姓名
    const conflictNameEl = document.getElementById('conflictName');
    if (conflictNameEl) conflictNameEl.textContent = name;
    
    // 生成建议名称
    const suggestedNameEl = document.getElementById('suggestedName');
    if (suggestedNameEl) {
        // 生成几个建议
        const suffix = gender === 'male' ? '先生' : '女士';
        suggestedNameEl.textContent = `${name} (${suffix}) 或 ${name}B`;
    }
    
    modal.classList.add('active');
}

function closeNameConflictModal() {
    const modal = document.getElementById('nameConflictModal');
    if (modal) {
        modal.classList.remove('active');
    }

    // 聚焦到姓名输入框并选中内容，方便用户修改
    const nameInput = document.getElementById('name');
    if (nameInput) {
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
    }
}

// ==================== 花名册校验相关函数 ====================

/**
 * 校验姓名和性别是否在花名册中
 * @param {string} name - 姓名
 * @param {string} gender - 性别
 * @returns {Promise<Object>} 校验结果
 */
async function validateRoster(name, gender) {
    try {
        const response = await fetch('/api/users/validate-registration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, gender })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Roster validation error:', error);
        // 出错时默认允许注册
        return { valid: true, canProceedAsGuest: false };
    }
}

/**
 * 显示花名册警告模态框
 * @param {string} message - 警告消息
 */
function showRosterWarningModal(message) {
    console.log('showRosterWarningModal called, currentRegistrationData:', currentRegistrationData);
    const modal = document.getElementById('rosterWarningModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * 关闭花名册警告模态框，返回修改
 */
function closeRosterWarningModal() {
    const modal = document.getElementById('rosterWarningModal');
    if (modal) {
        modal.classList.remove('active');
    }

    // 恢复提交按钮状态
    if (currentSubmitBtn) {
        currentSubmitBtn.disabled = false;
        currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
    }

    // 聚焦到姓名输入框
    const nameInput = document.getElementById('name');
    if (nameInput) {
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
    }
}

/**
 * 用户确认以嘉宾身份继续注册
 */
async function proceedAsGuest() {
    console.log('proceedAsGuest called, currentRegistrationData:', currentRegistrationData);

    // 检查数据是否存在
    if (!currentRegistrationData) {
        console.error('No registration data available');
        showMessage('注册数据丢失，请重新填写', 'error');

        // 恢复提交按钮状态
        if (currentSubmitBtn) {
            currentSubmitBtn.disabled = false;
            currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
        }
        return;
    }

    // 关闭警告模态框
    const modal = document.getElementById('rosterWarningModal');
    if (modal) {
        modal.classList.remove('active');
    }

    // 继续执行注册流程（跳过校验）
    try {
        const { name, gender } = currentRegistrationData;

        // Get current base URL from browser
        const currentBaseURL = `${window.location.protocol}//${window.location.host}`;

        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                gender,
                baseURL: currentBaseURL
            })
        });

        const result = await response.json();

        if (result.success) {
            // 保存注册信息到本地缓存
            localStorage.setItem(STORAGE_KEYS.USER_ID, result.userId);
            localStorage.setItem(STORAGE_KEYS.USER_NAME, result.name);
            localStorage.setItem(STORAGE_KEYS.USER_GENDER, result.gender);
            localStorage.setItem(STORAGE_KEYS.REGISTRATION_TIME, new Date().toISOString());

            // 保存数字ID
            if (result.numericId) {
                localStorage.setItem(STORAGE_KEYS.NUMERIC_ID, result.numericId);
            }

            // 新增：检查是否有待处理的返回URL
            const pendingReturnUrl = localStorage.getItem(STORAGE_KEYS.PENDING_RETURN_URL);
            const voteIntentTimestamp = localStorage.getItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);

            if (pendingReturnUrl && isVoteIntentValid(voteIntentTimestamp)) {
                // 清除待处理的返回URL
                localStorage.removeItem(STORAGE_KEYS.PENDING_RETURN_URL);
                localStorage.removeItem(STORAGE_KEYS.VOTE_INTENT_TIMESTAMP);

                showMessage(`注册成功！您的数字ID是：${result.numericId}。正在返回投票页面...`, 'success');

                // 显示投票按钮
                showVotingActions();

                setTimeout(() => {
                    window.location.href = pendingReturnUrl;
                }, 1500);
                return;
            }

            // 默认行为：跳转到个人页面
            showMessage(`注册成功！您的数字ID是：${result.numericId}。正在跳转到个人页面...`, 'success');

            // 显示投票按钮
            showVotingActions();

            setTimeout(() => {
                window.location.href = `/profile/${result.userId}`;
            }, 2000);
        } else {
            // 处理特定错误
            if (result.errorCode === 'NAME_ALREADY_EXISTS') {
                showNameConflictDialog(currentRegistrationData.name, currentRegistrationData.gender);
            } else {
                showMessage(result.message || '注册失败，请重试', 'error');
            }
        }
    } catch (error) {
        console.error('Guest registration error:', error);
        ErrorHandler.handleNetworkError(error, {
            context: 'Guest registration',
            retryAction: () => proceedAsGuest(),
            registrationData: currentRegistrationData
        });
    } finally {
        // 恢复提交按钮
        if (currentSubmitBtn) {
            currentSubmitBtn.disabled = false;
            currentSubmitBtn.textContent = currentSubmitBtnText || '注册参与';
            currentSubmitBtn = null;
            currentSubmitBtnText = '';
        }
        currentRegistrationData = null;
    }
}
