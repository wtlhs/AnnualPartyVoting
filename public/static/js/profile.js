// 个人信息页面 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const userId = getUserIdFromUrl();
    if (userId) {
        loadUserProfile(userId);
        setupAvatarUpload(userId);
        setupQRCodeReregisterTrigger(userId);
    } else {
        showError('无效的用户ID');
    }
});

function getUserIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadUserProfile(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        const result = await response.json();
        
        if (result.success) {
            displayUserInfo(result);
            if (result.qrCode) {
                // Use the QR code image returned by the API
                displayQRCode(result.qrCode);
            } else if (result.qrData) {
                // If we have QR data but no image, generate the image from the data
                generateQRCode(result.qrData);
            } else {
                // This should not happen after migration, but as a fallback
                showError('QR码数据缺失，请联系管理员');
            }
        } else {
            showError(result.message || '加载用户信息失败');
        }
    } catch (error) {
        console.error('Load profile error:', error);
        showError('网络错误，请刷新页面重试');
    }
}

function displayUserInfo(result) {
    document.getElementById('userName').textContent = result.name;
    document.getElementById('userGender').textContent = `性别: ${result.gender === 'male' ? '男士' : '女士'}`;
    document.getElementById('numericId').textContent = `数字ID: ${result.numericId || '未分配'}`;
    document.getElementById('voteCount').textContent = `获得票数: ${result.voteCount || 0}`;

    const avatarImg = document.getElementById('userAvatar');
    let avatarUrl = result.avatarUrl || getDefaultAvatar(result.gender);

    // 错误处理：如果头像加载失败（例如由于跨域或硬编码的 localhost 地址）
    avatarImg.onerror = function() {
        console.warn('Avatar failed to load:', avatarUrl);
        // 如果是完整的 URL，尝试转为相对路径
        if (avatarUrl && avatarUrl.startsWith('http')) {
            try {
                const url = new URL(avatarUrl);
                this.src = url.pathname;
                console.log('Retrying with relative path:', url.pathname);
            } catch (e) {
                this.src = getDefaultAvatar(result.gender);
            }
        } else {
            this.src = getDefaultAvatar(result.gender);
        }
        this.onerror = null; // 防止死循环
    };

    avatarImg.src = avatarUrl;
    avatarImg.alt = `${result.name}的头像`;
    avatarImg.title = '点击放大图片';

    // 设置头像点击预览功能
    setupImagePreview(avatarImg);
}

function getDefaultAvatar(gender) {
    return gender === 'male' ? '/static/images/default-male-avatar.svg' : '/static/images/default-female-avatar.svg';
}

function displayQRCode(qrCodeBase64) {
    const canvas = document.getElementById('qrCode');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        canvas.width = 200;
        canvas.height = 200;
        ctx.drawImage(img, 0, 0, 200, 200);
    };
    
    img.src = qrCodeBase64;
}

function generateQRCode(qrData) {
    const canvas = document.getElementById('qrCode');
    QRCode.toCanvas(canvas, qrData, {
        width: 200,
        margin: 2,
        color: {
            dark: '#333333',
            light: '#FFFFFF'
        }
    }, function (error) {
        if (error) {
            console.error('QR Code generation error:', error);
            showError('二维码生成失败');
        }
    });
}

function setupAvatarUpload(userId) {
    const uploadBtn = document.getElementById('uploadAvatarBtn');
    const avatarInput = document.getElementById('avatarInput');
    
    uploadBtn.addEventListener('click', () => {
        avatarInput.click();
    });
    
    avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadAvatar(userId, file);
        }
    });
}

async function uploadAvatar(userId, file) {
    // 验证文件类型和大小
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
        showError('只支持JPG和PNG格式的图片');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showError('图片大小不能超过10MB');
        return;
    }
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', userId);
    
    try {
        const response = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('userAvatar').src = result.avatarUrl;
            showSuccess('头像更新成功');
        } else {
            showError(result.message || '头像上传失败');
        }
    } catch (error) {
        console.error('Avatar upload error:', error);
        showError('网络错误，请重试');
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showMessage(message, type) {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // 创建新消息
    const messageDiv = document.createElement('div');
    const messageClass = type === 'error' ? 'error-message' :
                        type === 'info' ? 'info-message' : 'success-message';
    messageDiv.className = `message ${messageClass}`;
    messageDiv.textContent = message;

    // 插入到页面顶部
    const main = document.querySelector('main');
    main.insertBefore(messageDiv, main.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// 设置二维码连续点击触发重新注册的功能
function setupQRCodeReregisterTrigger(userId) {
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    if (!qrCodeContainer) return;

    // 添加点击提示样式
    qrCodeContainer.style.cursor = 'pointer';
    qrCodeContainer.style.transition = 'transform 0.1s';

    let clickCount = 0;
    const requiredClicks = 5;
    const clickTimeout = 2000; // 2秒内点击才算有效

    qrCodeContainer.addEventListener('click', () => {
        clickCount++;

        if (clickCount === requiredClicks) {
            // 达到5次点击，触发重新注册确认
            clickCount = 0;
            showReregisterConfirmDialog(userId);
        } else if (clickCount > 0) {
            // 2秒后重置点击计数
            setTimeout(() => {
                clickCount = 0;
            }, clickTimeout);
        }
    });
}

// 显示重新注册确认对话框
function showReregisterConfirmDialog(userId) {
    if (confirm('⚠️ 确定要清除当前注册信息并重新注册吗？\n\n这将删除您的所有账号数据，包括：\n• 个人信息\n• 投票记录\n• 二维码\n\n此操作不可恢复！')) {
        clearRegistrationAndReload(userId);
    }
}

// 清除注册信息并重新加载
async function clearRegistrationAndReload(userId) {
    try {
        showMessage('正在删除账号数据...', 'info');

        // 调用后端API删除用户数据(这会删除设备指纹)
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('✓ Backend user data deleted successfully');
        } else {
            console.error('Backend deletion failed:', result.message);
        }

        // 清除所有存储层的会话数据(包括设置重新注册标志)
        sessionManager.clearSession(true);

        showMessage('账号数据已删除，正在返回首页...', 'success');

        // 延迟跳转,让用户看到提示信息
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        console.error('Delete user account error:', error);

        // 即使网络错误,也要清除本地数据
        sessionManager.clearSession(true);

        showMessage('本地数据已清除,正在返回首页...', 'success');

        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
}

/**
 * 设置头像图片预览功能
 * 点击头像时显示大图预览
 * @param {HTMLElement} avatarEl - 头像元素
 */
function setupImagePreview(avatarEl) {
    if (!avatarEl) return;

    avatarEl.style.cursor = 'zoom-in';
    avatarEl.title = '点击放大图片';

    avatarEl.onclick = function(e) {
        e.stopPropagation();
        const modal = document.getElementById('imagePreviewModal');
        const previewImg = document.getElementById('previewImage');

        if (modal && previewImg) {
            previewImg.src = this.src;
            modal.classList.add('active');
        }
    };
}

/**
 * 关闭图片预览
 * 供HTML中的onclick调用
 */
window.closeImagePreview = function() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
};