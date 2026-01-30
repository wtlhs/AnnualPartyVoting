// 扫码页面 JavaScript
let html5QrCode = null;
let isScanning = false;
let currentCameraIndex = 0;
let availableCameras = [];

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
        return; // 如果未注册，不继续初始化扫码功能
    }
    
    setupScannerControls();
    setupManualInput();
    
    // 取消自动检查摄像头权限和启动扫描
    // checkCameraPermissions();
    
    // 默认显示手动输入框 (now handled in HTML, but kept for safety if toggled)
    // toggleManualInput();
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

function setupScannerControls() {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const switchBtn = document.getElementById('switchCameraBtn');
    const toggleManualBtn = document.getElementById('toggleManualBtn');
    
    startBtn.addEventListener('click', startScanning);
    stopBtn.addEventListener('click', stopScanning);
    switchBtn.addEventListener('click', switchCamera);
    toggleManualBtn.addEventListener('click', toggleManualInput);
}

async function checkCameraPermissions() {
    try {
        // Check if camera permission is available
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Permission granted, stop the stream immediately
            stream.getTracks().forEach(track => track.stop());
            // Auto start scanning
            startScanning();
        } else {
            // 如果 navigator.mediaDevices 不存在或 getUserMedia 不可用，手动抛出错误以便在 catch 中处理
            const error = new Error('Camera API not available');
            error.name = 'NotSupportedError';
            throw error;
        }
    } catch (error) {
        console.warn('Camera permission check failed:', error);
        let errorMessage = '无法访问摄像头，请使用手动输入功能';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或使用手动输入';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '未检测到摄像头设备，请使用手动输入功能';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = '当前浏览器不支持摄像头功能，请使用手动输入';
        } else if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && !location.hostname.startsWith('192.168.') && !location.hostname.startsWith('10.') && !location.hostname.startsWith('172.')) {
            errorMessage = '摄像头功能需要安全连接或局域网环境，请使用手动输入功能';
        }
        
        showMessage(errorMessage, 'error');
        // Show manual input option by default if camera is not available
        toggleManualInput();
    }
}

function setupManualInput() {
    const submitIdBtn = document.getElementById('submitIdBtn');
    const numericIdInput = document.getElementById('numericIdInput');
    
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
}

function updateSubmitButtonState() {
    const submitIdBtn = document.getElementById('submitIdBtn');
    const numericIdInput = document.getElementById('numericIdInput');
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

async function startScanning() {
    try {
        showMessage('正在启动摄像头...', 'info');
        
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("qr-reader");
        }
        
        // Check if already scanning
        if (isScanning) {
            showMessage('扫描已在进行中', 'info');
            return;
        }
        
        const config = {
            fps: 20, // 提高帧率
            aspectRatio: 1.0
            // qrbox: { width: 250, height: 250 } // 移除 qrbox 限制，使用全屏扫描以提高识别率
        };
        
        // 获取所有摄像头
        try {
            availableCameras = await Html5Qrcode.getCameras();
        } catch (e) {
            console.warn('Failed to get cameras list:', e);
            availableCameras = [];
        }
        
        // 尝试找到后置摄像头
        let cameraId = null;
        if (availableCameras && availableCameras.length > 0) {
            // 优先找包含 'back', 'rear', 'environment' 的摄像头
            const backCamera = availableCameras.find(camera => {
                const label = camera.label.toLowerCase();
                return label.includes('back') || label.includes('rear') || label.includes('environment');
            });
            
            if (backCamera) {
                cameraId = backCamera.id;
                // 更新当前索引
                currentCameraIndex = availableCameras.indexOf(backCamera);
            } else {
                // 如果没明确找到后置，就用最后一个（通常是后置）
                // 或者是列表中的第一个
                cameraId = availableCameras[availableCameras.length - 1].id;
                currentCameraIndex = availableCameras.length - 1;
            }
        }

        let started = false;

        // 策略1：如果有明确的摄像头ID，使用ID启动
        if (cameraId) {
            try {
                await html5QrCode.start(
                    cameraId,
                    config,
                    onScanSuccess,
                    onScanFailure
                );
                started = true;
            } catch (e) {
                console.warn('Failed to start with specific camera ID:', e);
            }
        }

        // 策略2：如果策略1失败，移动设备尝试强制后置模式
        if (!started) {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                try {
                    await html5QrCode.start(
                        { facingMode: { exact: "environment" } },
                        config,
                        onScanSuccess,
                        onScanFailure
                    );
                    started = true;
                } catch (e) {
                    console.warn('Strict environment mode failed:', e);
                }
            }
        }

        // 策略3：如果前面的都失败了，尝试通用后置模式
        if (!started) {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess,
                    onScanFailure
                );
                started = true;
            } catch (error) {
                console.warn('Environment mode failed, trying fallback:', error);
                
                // 策略4：最后尝试任何可用摄像头（通常是前置）
                try {
                    await html5QrCode.start(
                        { facingMode: "user" },
                        config,
                        onScanSuccess,
                        onScanFailure
                    );
                    started = true;
                } catch (fallbackError) {
                     // 真的失败了
                     throw fallbackError;
                }
            }
        }
        
        isScanning = true;
        updateScannerUI();
        showMessage('扫描已启动，请将二维码对准摄像头', 'success');
        
    } catch (error) {
        console.error('Start scanning error:', error);
        isScanning = false;
        updateScannerUI();
        
        let errorMessage = '无法启动摄像头，请使用手动输入功能';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = '摄像头权限被拒绝。请在浏览器地址栏左侧点击锁图标，允许摄像头访问，然后刷新页面重试。或使用手动输入功能。';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '未找到摄像头设备，请使用手动输入功能';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = '当前浏览器不支持摄像头功能，请使用手动输入';
        } else if (error.name === 'NotReadableError') {
            errorMessage = '摄像头被其他应用占用，请关闭其他使用摄像头的应用后重试，或使用手动输入';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = '摄像头不支持所需的配置，请使用手动输入功能';
        } else if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && !location.hostname.startsWith('192.168.') && !location.hostname.startsWith('10.') && !location.hostname.startsWith('172.')) {
            errorMessage = '摄像头功能需要安全连接或局域网环境，请使用手动输入功能';
        } else if (error.message) {
            errorMessage = `摄像头启动失败：${error.message}，请使用手动输入功能`;
        }
        
        showError(errorMessage);
        toggleManualInput();
    }
}

async function stopScanning() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            isScanning = false;
            updateScannerUI();
            showMessage('扫描已停止', 'info');
        } catch (error) {
            console.error('Stop scanning error:', error);
            isScanning = false;
            updateScannerUI();
        }
    }
}

function updateScannerUI() {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const switchBtn = document.getElementById('switchCameraBtn');
    
    if (isScanning) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        // 只有当有多个摄像头时才显示切换按钮
        if (availableCameras && availableCameras.length > 1) {
            switchBtn.style.display = 'block';
        } else {
            switchBtn.style.display = 'none';
        }
    } else {
        startBtn.style.display = 'none'; // 始终隐藏，即使未在扫描
        stopBtn.style.display = 'none';
        switchBtn.style.display = 'none';
    }
}

async function switchCamera() {
    if (!availableCameras || availableCameras.length < 2) {
        showMessage('未检测到多个摄像头', 'info');
        return;
    }

    try {
        await html5QrCode.stop();
        isScanning = false;
        
        // 切换到下一个摄像头
        currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
        const nextCameraId = availableCameras[currentCameraIndex].id;
        
        showMessage(`正在切换摄像头...`, 'info');
        
        const config = {
            fps: 20,
            aspectRatio: 1.0
        };
        
        await html5QrCode.start(
            nextCameraId,
            config,
            onScanSuccess,
            onScanFailure
        );
        
        isScanning = true;
        updateScannerUI();
        showMessage('已切换摄像头', 'success');
        
    } catch (error) {
        console.error('Switch camera error:', error);
        showError('切换摄像头失败');
        isScanning = false;
        updateScannerUI();
    }
}

function onScanSuccess(decodedText) {
    showMessage('二维码扫描成功，正在验证...', 'info');
    processQRCode(decodedText);
    stopScanning();
}

function onScanFailure(error) {
    // 扫描失败是正常的，不需要显示错误
    // 只在控制台记录详细错误信息用于调试
    if (error && !error.includes('No MultiFormat Readers')) {
        // 静默处理扫描失败
    }
}

function processQRCode(qrData) {
    try {
        // Validate that qrData is not empty
        if (!qrData || !qrData.trim()) {
            showError('二维码内容为空，请重新扫描');
            return;
        }
        
        // First try to parse as JSON to validate format
        const data = JSON.parse(qrData);
        
        if (data.type === 'vote' && data.userId) {
            // Validate QR code with backend before proceeding
            validateQRCodeWithBackend(qrData);
        } else {
            showError('无效的投票二维码格式，请确认扫描的是正确的投票二维码');
        }
    } catch (error) {
        console.error('QR Code parsing error:', error);
        showError('二维码格式错误，请确认扫描的是正确的投票二维码');
    }
}

async function validateQRCodeWithBackend(qrData) {
    try {
        showMessage('验证二维码中...', 'info');
        
        const response = await fetch('/api/users/validate-qr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ qrData })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // QR code is valid, show success message and redirect to vote page
            showMessage(`验证成功！即将跳转到 ${result.name} 的投票页面...`, 'success');
            
            // Delay redirect to show success message
            setTimeout(() => {
                window.location.href = `/vote/${result.userId}`;
            }, 1500);
        } else {
            // Handle specific error cases
            if (result.errorCode === 'USER_NOT_FOUND') {
                showError('该参与者不存在，请确认二维码是否正确');
            } else if (result.errorCode === 'INVALID_QR_CODE') {
                showError('二维码已失效或不匹配，请重新扫描');
            } else if (result.errorCode === 'INVALID_QR_FORMAT') {
                showError('二维码格式错误，请确认扫描的是正确的投票二维码');
            } else {
                showError(result.message || '二维码验证失败，请重试');
            }
        }
    } catch (error) {
        console.error('QR validation error:', error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showError('网络连接失败，请检查网络后重试');
        } else {
            showError('验证过程中发生错误，请重试');
        }
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
        submitIdBtn.disabled = false;
        submitIdBtn.textContent = '确认投票';
        updateSubmitButtonState();
    }
}

function toggleManualInput() {
    const manualDiv = document.querySelector('.manual-input');
    const toggleBtn = document.getElementById('toggleManualBtn');
    
    if (manualDiv.style.display === 'none' || !manualDiv.style.display) {
        manualDiv.style.display = 'block';
        toggleBtn.textContent = '隐藏手动输入';
        
        // 聚焦到输入框
        const numericIdInput = document.getElementById('numericIdInput');
        if (numericIdInput) {
            setTimeout(() => numericIdInput.focus(), 100);
        }
    } else {
        manualDiv.style.display = 'none';
        toggleBtn.textContent = '手动输入ID';
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
    main.insertBefore(messageDiv, main.firstChild);
    
    // 对于非info类型的消息，3秒后自动移除
    if (type !== 'info') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}