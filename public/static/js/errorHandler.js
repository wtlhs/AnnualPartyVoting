/**
 * 错误处理工具类
 * 处理投票注册验证功能中的各种错误情况，提供错误恢复机制
 * 
 * 需求: 4.3
 */

class ErrorHandler {
  // 错误类型常量
  static ERROR_TYPES = {
    STORAGE_ERROR: 'storage_error',
    URL_ERROR: 'url_error',
    REDIRECT_ERROR: 'redirect_error',
    VALIDATION_ERROR: 'validation_error',
    NETWORK_ERROR: 'network_error'
  };

  // 错误严重级别
  static SEVERITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  };

  /**
   * 处理本地存储相关错误
   * @param {Error} error - 错误对象
   * @param {Function} fallbackAction - 备用操作函数
   * @param {Object} context - 错误上下文信息
   */
  static handleStorageError(error, fallbackAction = null, context = {}) {
    const errorDetails = {
      type: this.ERROR_TYPES.STORAGE_ERROR,
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Local storage error:', errorDetails);

    // 记录错误到审计日志
    this.logError(errorDetails, this.SEVERITY_LEVELS.MEDIUM);

    // 尝试诊断存储问题
    const storageStatus = this.diagnoseStorageIssue();
    
    if (storageStatus.isQuotaExceeded) {
      // 存储空间不足：清理过期数据
      this.cleanupExpiredData();
      this.showUserMessage('存储空间不足，已清理过期数据，请重试', 'warning');
    } else if (storageStatus.isDisabled) {
      // 浏览器禁用存储：使用URL参数作为备用方案
      this.showUserMessage('浏览器存储被禁用，将使用临时存储方案', 'info');
      if (fallbackAction && typeof fallbackAction === 'function') {
        try {
          fallbackAction();
        } catch (fallbackError) {
          console.error('Fallback action failed:', fallbackError);
          this.handleCriticalError(fallbackError, 'Storage fallback failed');
        }
      }
    } else if (storageStatus.isCorrupted) {
      // 数据损坏：清理损坏数据，重新开始流程
      this.clearCorruptedData();
      this.showUserMessage('检测到数据异常，已重置，请重新开始', 'warning');
      // 重定向到首页重新开始
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else {
      // 其他存储错误
      this.showUserMessage('存储操作失败，请刷新页面重试', 'error');
    }
  }

  /**
   * 处理URL相关错误
   * @param {Error} error - 错误对象
   * @param {string} returnUrl - 原始返回URL
   * @param {Object} context - 错误上下文
   * @returns {string} 安全的URL
   */
  static handleUrlError(error, returnUrl = '', context = {}) {
    const errorDetails = {
      type: this.ERROR_TYPES.URL_ERROR,
      message: error.message,
      originalUrl: returnUrl,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    };

    console.error('URL processing error:', errorDetails);
    this.logError(errorDetails, this.SEVERITY_LEVELS.MEDIUM);

    // 尝试修复URL
    let safeUrl = '/';
    
    try {
      if (window.URLUtils && typeof window.URLUtils.sanitizeReturnUrl === 'function') {
        safeUrl = window.URLUtils.sanitizeReturnUrl(returnUrl);
      } else {
        // 备用URL清理逻辑
        safeUrl = this.basicUrlSanitization(returnUrl);
      }
    } catch (sanitizeError) {
      console.error('URL sanitization failed:', sanitizeError);
      safeUrl = '/';
    }

    // 根据错误类型显示不同的用户消息
    if (error.message.includes('Invalid return URL origin')) {
      this.showUserMessage('检测到不安全的跳转链接，已重定向到安全页面', 'warning');
    } else if (error.message.includes('URL parsing failed')) {
      this.showUserMessage('链接格式错误，请重新扫描二维码', 'error');
    } else {
      this.showUserMessage('链接处理失败，已跳转到首页', 'info');
    }

    return safeUrl;
  }

  /**
   * 处理重定向相关错误
   * @param {Error} error - 错误对象
   * @param {string} defaultPath - 默认重定向路径
   * @param {Object} context - 错误上下文
   */
  static handleRedirectError(error, defaultPath = '/', context = {}) {
    const errorDetails = {
      type: this.ERROR_TYPES.REDIRECT_ERROR,
      message: error.message,
      defaultPath: defaultPath,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    };

    console.error('Redirect error:', errorDetails);
    this.logError(errorDetails, this.SEVERITY_LEVELS.HIGH);

    // 检测循环重定向
    if (this.detectRedirectLoop()) {
      this.showUserMessage('检测到重定向循环，已停止自动跳转', 'error');
      this.showManualNavigationOptions();
      return;
    }

    // 显示用户友好的错误消息
    this.showUserMessage('页面跳转失败，正在尝试恢复...', 'warning');

    // 延迟重定向，给用户时间看到消息
    setTimeout(() => {
      try {
        window.location.href = defaultPath;
      } catch (redirectError) {
        console.error('Final redirect failed:', redirectError);
        this.handleCriticalError(redirectError, 'All redirect attempts failed');
      }
    }, 2000);
  }

  /**
   * 处理验证错误
   * @param {Error} error - 错误对象
   * @param {Object} validationContext - 验证上下文
   */
  static handleValidationError(error, validationContext = {}) {
    const errorDetails = {
      type: this.ERROR_TYPES.VALIDATION_ERROR,
      message: error.message,
      validationContext: validationContext,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    };

    console.error('Validation error:', errorDetails);
    this.logError(errorDetails, this.SEVERITY_LEVELS.MEDIUM);

    // 根据验证错误类型提供具体的用户指导
    if (validationContext.field === 'registration') {
      this.showUserMessage('注册信息验证失败，请检查输入内容', 'error');
    } else if (validationContext.field === 'vote_params') {
      this.showUserMessage('投票参数无效，请重新扫描二维码', 'error');
    } else {
      this.showUserMessage('数据验证失败，请重试', 'error');
    }
  }

  /**
   * 处理网络错误
   * @param {Error} error - 错误对象
   * @param {Object} networkContext - 网络上下文
   */
  static handleNetworkError(error, networkContext = {}) {
    const errorDetails = {
      type: this.ERROR_TYPES.NETWORK_ERROR,
      message: error.message,
      networkContext: networkContext,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href,
      onlineStatus: navigator.onLine
    };

    console.error('Network error:', errorDetails);
    this.logError(errorDetails, this.SEVERITY_LEVELS.HIGH);

    if (!navigator.onLine) {
      this.showUserMessage('网络连接已断开，请检查网络后重试', 'error');
    } else {
      this.showUserMessage('网络请求失败，请稍后重试', 'error');
    }

    // 提供手动重试选项
    this.showRetryOption(networkContext.retryAction);
  }

  /**
   * 处理关键错误（系统级错误）
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文描述
   */
  static handleCriticalError(error, context = '') {
    const errorDetails = {
      type: 'critical_error',
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    };

    console.error('Critical error:', errorDetails);
    this.logError(errorDetails, this.SEVERITY_LEVELS.CRITICAL);

    // 显示系统错误页面
    this.showCriticalErrorPage(errorDetails);
  }

  /**
   * 诊断本地存储问题
   * @returns {Object} 诊断结果
   */
  static diagnoseStorageIssue() {
    const diagnosis = {
      isAvailable: false,
      isQuotaExceeded: false,
      isDisabled: false,
      isCorrupted: false,
      availableSpace: 0
    };

    try {
      // 测试存储可用性
      const testKey = '__storage_test__';
      const testValue = 'test';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      diagnosis.isAvailable = retrieved === testValue;
      
      if (!diagnosis.isAvailable) {
        diagnosis.isCorrupted = true;
      }
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        diagnosis.isQuotaExceeded = true;
      } else if (error.name === 'SecurityError') {
        diagnosis.isDisabled = true;
      } else {
        diagnosis.isCorrupted = true;
      }
    }

    // 估算可用存储空间
    try {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
          diagnosis.availableSpace = estimate.quota - estimate.usage;
        });
      }
    } catch (error) {
      console.warn('Could not estimate storage space:', error);
    }

    return diagnosis;
  }

  /**
   * 清理过期数据
   */
  static cleanupExpiredData() {
    const storageKeys = [
      'annual_party_user_id',
      'annual_party_user_name',
      'annual_party_user_gender',
      'annual_party_numeric_id',
      'annual_party_registration_time',
      'pending_return_url',
      'vote_intent_timestamp'
    ];

    let cleanedCount = 0;

    storageKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          // 检查是否为时间戳相关的数据
          if (key.includes('time') || key.includes('timestamp')) {
            const timestamp = new Date(value);
            const now = new Date();
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            // 清理超过24小时的数据
            if (hoursDiff > 24) {
              localStorage.removeItem(key);
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to clean storage key ${key}:`, error);
      }
    });

    console.log(`Cleaned ${cleanedCount} expired storage items`);
  }

  /**
   * 清理损坏的数据
   */
  static clearCorruptedData() {
    try {
      // 尝试清理所有相关的存储数据
      const storageKeys = Object.keys(localStorage);
      const appKeys = storageKeys.filter(key => 
        key.startsWith('annual_party_') || 
        key.startsWith('pending_') ||
        key.startsWith('vote_')
      );

      appKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove corrupted key ${key}:`, error);
        }
      });

      console.log('Cleared corrupted storage data');
    } catch (error) {
      console.error('Failed to clear corrupted data:', error);
      // 最后手段：清理所有本地存储
      try {
        localStorage.clear();
      } catch (clearError) {
        console.error('Failed to clear all storage:', clearError);
      }
    }
  }

  /**
   * 基础URL清理（备用方案）
   * @param {string} url - 要清理的URL
   * @returns {string} 清理后的URL
   */
  static basicUrlSanitization(url) {
    if (!url || typeof url !== 'string') {
      return '/';
    }

    try {
      // 移除潜在的危险字符
      const cleaned = url
        .replace(/[<>'"]/g, '') // 移除HTML字符
        .replace(/javascript:/gi, '') // 移除JavaScript协议
        .replace(/data:/gi, '') // 移除data协议
        .replace(/vbscript:/gi, ''); // 移除VBScript协议

      // 确保URL以/开头（相对路径）
      if (cleaned.startsWith('/')) {
        return cleaned;
      } else {
        return '/';
      }
    } catch (error) {
      console.error('Basic URL sanitization failed:', error);
      return '/';
    }
  }

  /**
   * 检测重定向循环
   * @returns {boolean} 是否检测到循环
   */
  static detectRedirectLoop() {
    const redirectHistory = JSON.parse(
      sessionStorage.getItem('redirect_history') || '[]'
    );
    
    const currentUrl = window.location.href;
    const now = Date.now();
    
    // 清理超过5分钟的历史记录
    const recentHistory = redirectHistory.filter(
      entry => now - entry.timestamp < 5 * 60 * 1000
    );
    
    // 检查是否在短时间内多次访问同一URL
    const sameUrlCount = recentHistory.filter(
      entry => entry.url === currentUrl
    ).length;
    
    // 添加当前访问记录
    recentHistory.push({ url: currentUrl, timestamp: now });
    sessionStorage.setItem('redirect_history', JSON.stringify(recentHistory));
    
    return sameUrlCount >= 3; // 3次以上认为是循环
  }

  /**
   * 显示用户消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (info, warning, error, success)
   */
  static showUserMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.error-handler-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `error-handler-message message-${type}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        <span class="message-icon">${this.getMessageIcon(type)}</span>
        <span class="message-text">${message}</span>
        <button class="message-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // 添加样式
    this.addMessageStyles();

    // 插入到页面顶部
    document.body.insertBefore(messageDiv, document.body.firstChild);

    // 自动移除消息
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  /**
   * 获取消息图标
   * @param {string} type - 消息类型
   * @returns {string} 图标
   */
  static getMessageIcon(type) {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };
    return icons[type] || icons.info;
  }

  /**
   * 添加消息样式
   */
  static addMessageStyles() {
    if (document.querySelector('#error-handler-styles')) {
      return; // 样式已存在
    }

    const style = document.createElement('style');
    style.id = 'error-handler-styles';
    style.textContent = `
      .error-handler-message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        max-width: 500px;
        width: 90%;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInDown 0.3s ease-out;
      }

      .error-handler-message.message-info {
        background: #e3f2fd;
        border-left: 4px solid #2196f3;
        color: #1565c0;
      }

      .error-handler-message.message-warning {
        background: #fff3e0;
        border-left: 4px solid #ff9800;
        color: #ef6c00;
      }

      .error-handler-message.message-error {
        background: #ffebee;
        border-left: 4px solid #f44336;
        color: #c62828;
      }

      .error-handler-message.message-success {
        background: #e8f5e8;
        border-left: 4px solid #4caf50;
        color: #2e7d32;
      }

      .message-content {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 8px;
      }

      .message-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .message-text {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }

      .message-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .message-close:hover {
        opacity: 1;
      }

      @keyframes slideInDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 显示手动导航选项
   */
  static showManualNavigationOptions() {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'manual-navigation-options';
    optionsDiv.innerHTML = `
      <div class="navigation-content">
        <h3>页面跳转失败</h3>
        <p>请选择以下选项继续：</p>
        <div class="navigation-buttons">
          <button onclick="window.location.href='/'" class="nav-btn primary">返回首页</button>
          <button onclick="window.location.reload()" class="nav-btn secondary">刷新页面</button>
          <button onclick="history.back()" class="nav-btn secondary">返回上页</button>
        </div>
      </div>
    `;

    // 添加样式和显示
    this.addNavigationStyles();
    document.body.appendChild(optionsDiv);
  }

  /**
   * 添加导航选项样式
   */
  static addNavigationStyles() {
    if (document.querySelector('#navigation-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'navigation-styles';
    style.textContent = `
      .manual-navigation-options {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        text-align: center;
        max-width: 400px;
        width: 90%;
      }

      .navigation-content h3 {
        margin: 0 0 15px 0;
        color: #333;
      }

      .navigation-content p {
        margin: 0 0 20px 0;
        color: #666;
      }

      .navigation-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .nav-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
      }

      .nav-btn.primary {
        background: #2196f3;
        color: white;
      }

      .nav-btn.primary:hover {
        background: #1976d2;
      }

      .nav-btn.secondary {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
      }

      .nav-btn.secondary:hover {
        background: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 显示重试选项
   * @param {Function} retryAction - 重试操作函数
   */
  static showRetryOption(retryAction) {
    if (typeof retryAction !== 'function') {
      return;
    }

    const retryDiv = document.createElement('div');
    retryDiv.className = 'retry-option';
    retryDiv.innerHTML = `
      <button class="retry-btn" onclick="this.parentElement.remove()">重试</button>
    `;

    retryDiv.querySelector('.retry-btn').addEventListener('click', () => {
      try {
        retryAction();
      } catch (error) {
        console.error('Retry action failed:', error);
        this.showUserMessage('重试失败，请刷新页面', 'error');
      }
    });

    // 添加到最后一个错误消息后面
    const lastMessage = document.querySelector('.error-handler-message:last-of-type');
    if (lastMessage) {
      lastMessage.appendChild(retryDiv);
    }
  }

  /**
   * 显示关键错误页面
   * @param {Object} errorDetails - 错误详情
   */
  static showCriticalErrorPage(errorDetails) {
    document.body.innerHTML = `
      <div class="critical-error-page">
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <h1>系统错误</h1>
          <p>很抱歉，系统遇到了一个严重错误。</p>
          <div class="error-actions">
            <button onclick="window.location.reload()" class="error-btn primary">刷新页面</button>
            <button onclick="window.location.href='/'" class="error-btn secondary">返回首页</button>
          </div>
          <details class="error-details">
            <summary>错误详情</summary>
            <pre>${JSON.stringify(errorDetails, null, 2)}</pre>
          </details>
        </div>
      </div>
    `;

    // 添加关键错误页面样式
    const style = document.createElement('style');
    style.textContent = `
      .critical-error-page {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
      }

      .error-container {
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 500px;
        width: 90%;
      }

      .error-icon {
        font-size: 4em;
        margin-bottom: 20px;
      }

      .error-container h1 {
        margin: 0 0 15px 0;
        color: #333;
      }

      .error-container p {
        margin: 0 0 30px 0;
        color: #666;
        line-height: 1.5;
      }

      .error-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-bottom: 30px;
      }

      .error-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.3s;
      }

      .error-btn.primary {
        background: #f44336;
        color: white;
      }

      .error-btn.primary:hover {
        background: #d32f2f;
      }

      .error-btn.secondary {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
      }

      .error-btn.secondary:hover {
        background: #e0e0e0;
      }

      .error-details {
        text-align: left;
        margin-top: 20px;
      }

      .error-details summary {
        cursor: pointer;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 10px;
      }

      .error-details pre {
        background: #f8f8f8;
        padding: 15px;
        border-radius: 4px;
        overflow: auto;
        font-size: 12px;
        max-height: 200px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 记录错误到审计日志
   * @param {Object} errorDetails - 错误详情
   * @param {string} severity - 错误严重级别
   */
  static logError(errorDetails, severity = this.SEVERITY_LEVELS.MEDIUM) {
    const logEntry = {
      ...errorDetails,
      severity: severity,
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId()
    };

    // 输出到控制台
    console.error('Error logged:', logEntry);

    // 存储到本地（用于后续上报）
    try {
      const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
      errorLog.push(logEntry);
      
      // 只保留最近50条错误记录
      if (errorLog.length > 50) {
        errorLog.splice(0, errorLog.length - 50);
      }
      
      localStorage.setItem('error_log', JSON.stringify(errorLog));
    } catch (storageError) {
      console.warn('Failed to store error log:', storageError);
    }

    // 如果是高严重级别错误，尝试立即上报
    if (severity === this.SEVERITY_LEVELS.HIGH || severity === this.SEVERITY_LEVELS.CRITICAL) {
      this.reportErrorToServer(logEntry);
    }
  }

  /**
   * 获取会话ID
   * @returns {string} 会话ID
   */
  static getSessionId() {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * 获取当前用户ID
   * @returns {string|null} 用户ID
   */
  static getCurrentUserId() {
    try {
      return localStorage.getItem('annual_party_user_id') || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 上报错误到服务器
   * @param {Object} errorDetails - 错误详情
   */
  static reportErrorToServer(errorDetails) {
    // 这里可以实现向服务器上报错误的逻辑
    // 由于当前系统没有专门的错误上报端点，这里只是预留接口
    try {
      // 示例：可以发送到现有的API端点
      fetch('/api/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorDetails)
      }).catch(reportError => {
        console.warn('Failed to report error to server:', reportError);
      });
    } catch (error) {
      console.warn('Error reporting failed:', error);
    }
  }

  /**
   * 获取错误统计信息
   * @returns {Object} 错误统计
   */
  static getErrorStats() {
    try {
      const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
      const stats = {
        total: errorLog.length,
        byType: {},
        bySeverity: {},
        recent: errorLog.filter(error => {
          const errorTime = new Date(error.timestamp);
          const now = new Date();
          return (now - errorTime) < 24 * 60 * 60 * 1000; // 最近24小时
        }).length
      };

      errorLog.forEach(error => {
        stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return { total: 0, byType: {}, bySeverity: {}, recent: 0 };
    }
  }

  /**
   * 清理错误日志
   */
  static clearErrorLog() {
    try {
      localStorage.removeItem('error_log');
      console.log('Error log cleared');
    } catch (error) {
      console.error('Failed to clear error log:', error);
    }
  }
}

// 导出错误处理类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
} else if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}

// 全局错误处理器
window.addEventListener('error', function(event) {
  ErrorHandler.handleCriticalError(event.error, 'Global error handler');
});

window.addEventListener('unhandledrejection', function(event) {
  ErrorHandler.handleCriticalError(new Error(event.reason), 'Unhandled promise rejection');
});