// 扫码页面 JavaScript - 简化版（仅保留手动输入功能）

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
        return; // 如果未注册，不继续初始化
    }
    
    // 初始化手动输入功能
    setupManualInput();
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
                <p>只有注册用户才能进行投票。</p>
                <div class="notice-actions">
                    <a href="/" class="btn-primary">立即注册</a>
                    <a href="/" class="btn-secondary">返回首页</a>
                </div>
            </div>
        </div>
    `;
}

function setupManualInput() {
    const submitIdBtn = document.getElementById('submitIdBtn');
    const numericIdInput = document.getElementById('numericIdInput');
    
    if (!submitIdBtn || !numericIdInput) return;
    
    // 数字ID输入提交
    submitIdBtn.addEventListener('click', () => {
        const numericId = numericIdInput.value.trim();
        if (numericId) {
            processNumericId(numericId);
        } else {
            showError('请输入6位数字ID');
        }
    });
    
    // 数字ID输入验证
    numericIdInput.addEventListener('input', (e) => {
        // 只允许数字
        e.target.value = e.target.value.replace(/\D/g, '');
        
        // 限制为6位数字
        if (e.target.value.length > 6) {
            e.target.value = e.target.value.slice(0, 6);
        }
        
        // 实时验证并更新按钮状态
        updateSubmitButtonState();
    });
    
    // 回车键支持
    numericIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitIdBtn.click();
        }
    });
    
    // 初始化按钮状态
    updateSubmitButtonState();
    
    // 自动聚焦
    setTimeout(() => numericIdInput.focus(), 500);
}

function updateSubmitButtonState() {
    const submitIdBtn = document.getElementById('submitIdBtn');
    const numericIdInput = document.getElementById('numericIdInput');
    
    if (!submitIdBtn || !numericIdInput) return;
    
    const value = numericIdInput.value.trim();
    
    if (value.length === 6 && /^\d{6}$/.test(value)) {
        submitIdBtn.disabled = false;
        submitIdBtn.textContent = '确认投票';
        submitIdBtn.style.opacity = '1';
    } else {
        submitIdBtn.disabled = true;
        if (value.length === 0) {
            submitIdBtn.textContent = '请输入ID';
        } else if (value.length < 6) {
            submitIdBtn.textContent = `还需${6 - value.length}位数字`;
        } else {
            submitIdBtn.textContent = '确认投票';
        }
        submitIdBtn.style.opacity = '0.6';
    }
}

async function processNumericId(numericId) {
    try {
        // 验证数字ID格式
        if (!/^\d{6}$/.test(numericId)) {
            showError('ID必须是6位数字');
            return;
        }
        
        // 禁用按钮防止重复提交
        const submitIdBtn = document.getElementById('submitIdBtn');
        const originalText = submitIdBtn.textContent;
        submitIdBtn.disabled = true;
        submitIdBtn.textContent = '验证中...';
        
        showMessage('验证数字ID中...', 'info');
        
        const response = await fetch('/api/users/lookup-by-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numericId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // ID验证成功，显示成功消息并跳转到投票页面
            showMessage(`验证成功！即将跳转到 ${result.name} 的投票页面...`, 'success');
            
            // 延迟跳转以显示成功消息
            setTimeout(() => {
                window.location.href = `/vote/${result.userId}`;
            }, 1500);
        } else {
            // 处理特定错误情况
            if (result.errorCode === 'USER_NOT_FOUND') {
                showError('未找到该ID对应的用户，请检查ID是否正确');
            } else if (result.errorCode === 'INVALID_NUMERIC_ID_FORMAT') {
                showError('ID必须是6位数字');
            } else {
                showError(result.message || 'ID验证失败，请重试');
            }
            
            // 恢复按钮状态
            submitIdBtn.disabled = false;
            submitIdBtn.textContent = originalText;
            
            // 清空输入框并重新聚焦
            document.getElementById('numericIdInput').value = '';
            document.getElementById('numericIdInput').focus();
            updateSubmitButtonState();
        }
    } catch (error) {
        console.error('Numeric ID validation error:', error);
        
        let errorMessage = '验证过程中发生错误，请重试';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络后重试';
        }
        
        showError(errorMessage);
        
        // 恢复按钮状态
        const submitIdBtn = document.getElementById('submitIdBtn');
        if (submitIdBtn) {
            submitIdBtn.disabled = false;
            submitIdBtn.textContent = '确认投票';
            updateSubmitButtonState();
        }
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息
    const messageDiv = document.createElement('div');
    let className = 'message';
    if (type === 'error') {
        className += ' error-message';
    } else if (type === 'success') {
        className += ' success-message';
    } else if (type === 'info') {
        className += ' info-message';
    }
    messageDiv.className = className;
    messageDiv.textContent = message;
    
    // 插入到页面顶部
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(messageDiv, main.firstChild);
    }
    
    // 对于非info类型的消息，3秒后自动移除
    if (type !== 'info') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}
