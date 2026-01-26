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
    REGISTRATION_TIME: 'annual_party_registration_time'
};

function checkExistingRegistration() {
    const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    const userName = localStorage.getItem(STORAGE_KEYS.USER_NAME);
    const registrationTime = localStorage.getItem(STORAGE_KEYS.REGISTRATION_TIME);
    
    if (userId && userName && registrationTime) {
        // 检查注册时间是否在合理范围内（24小时内）
        const regTime = new Date(registrationTime);
        const now = new Date();
        const hoursDiff = (now - regTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
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
        
        // 网络错误时，本地缓存已清除，直接跳转到首页
        showMessage('本地数据已清除，正在返回首页...', 'success');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
}

function clearRegistrationCache() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
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
    
    // 显示模态框
    const modal = document.getElementById('genderConfirmationModal');
    modal.classList.add('active');
    
    // 添加事件监听器，实时更新显示的性别
    modalGenderRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const newGender = this.value;
            document.getElementById('confirmGender').textContent = newGender === 'male' ? '男' : '女';
            currentRegistrationData.gender = newGender;
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
        
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, gender })
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
            
            showMessage(`注册成功！您的数字ID是：${result.numericId}。正在跳转到个人页面...`, 'success');
            
            // 显示投票按钮
            showVotingActions();
            
            setTimeout(() => {
                window.location.href = `/profile/${result.userId}`;
            }, 2000);
        } else {
            // 处理特定错误
            if (result.errorCode === 'NAME_ALREADY_EXISTS') {
                showMessage('该姓名已被其他人注册，请使用不同的姓名', 'error');
            } else {
                showMessage(result.message || '注册失败，请重试', 'error');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('网络错误，请检查连接后重试', 'error');
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