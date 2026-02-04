/**
 * URL工具函数模块
 * 提供URL构建、解析和验证功能，包含安全性检查防止开放重定向攻击
 * 
 * 需求: 2.1, 2.2, 3.2
 */

class URLUtils {
  /**
   * 构建包含参数的返回URL
   * @param {string} baseUrl - 基础URL
   * @param {Object} params - URL参数对象
   * @returns {string} 构建的完整URL
   */
  static buildReturnUrl(baseUrl, params = {}) {
    try {
      // 确保baseUrl是完整的URL或相对路径
      const url = new URL(baseUrl, window.location.origin);
      
      // 添加参数到URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
      
      return url.toString();
    } catch (error) {
      console.error('Error building return URL:', error);
      // 返回安全的默认URL
      return window.location.origin + '/';
    }
  }

  /**
   * 解析返回URL并验证其安全性
   * @param {string} returnUrl - 要解析的返回URL
   * @returns {Object} 解析结果对象
   */
  static parseReturnUrl(returnUrl) {
    try {
      // 处理空值或无效输入
      if (!returnUrl || typeof returnUrl !== 'string') {
        return { isValid: false, error: 'Invalid URL input' };
      }

      // 创建URL对象进行解析
      const url = new URL(returnUrl, window.location.origin);
      
      // 安全性检查：验证URL来源
      if (url.origin !== window.location.origin) {
        console.warn('Rejected return URL with different origin:', url.origin);
        return { 
          isValid: false, 
          error: 'Invalid return URL origin',
          rejectedOrigin: url.origin 
        };
      }

      // 安全性检查：验证协议
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        console.warn('Rejected return URL with invalid protocol:', url.protocol);
        return { 
          isValid: false, 
          error: 'Invalid URL protocol',
          rejectedProtocol: url.protocol 
        };
      }

      // 安全性检查：防止路径遍历攻击
      const normalizedPath = url.pathname.replace(/\/+/g, '/');
      if (normalizedPath.includes('..') || normalizedPath.includes('//')) {
        console.warn('Rejected return URL with path traversal attempt:', normalizedPath);
        return { 
          isValid: false, 
          error: 'Invalid URL path',
          rejectedPath: normalizedPath 
        };
      }

      // 提取搜索参数
      const searchParams = {};
      url.searchParams.forEach((value, key) => {
        searchParams[key] = value;
      });

      return {
        isValid: true,
        pathname: url.pathname,
        searchParams: searchParams,
        fullUrl: url.toString(),
        hash: url.hash
      };
    } catch (error) {
      console.error('Error parsing return URL:', error);
      return { 
        isValid: false, 
        error: 'URL parsing failed',
        originalError: error.message 
      };
    }
  }

  /**
   * 清理并验证返回URL，返回安全的URL
   * @param {string} returnUrl - 要清理的返回URL
   * @returns {string} 清理后的安全URL
   */
  static sanitizeReturnUrl(returnUrl) {
    const parsed = this.parseReturnUrl(returnUrl);
    
    if (parsed.isValid) {
      return parsed.fullUrl;
    } else {
      // 记录安全事件
      console.warn('Sanitized unsafe return URL:', {
        originalUrl: returnUrl,
        error: parsed.error,
        timestamp: new Date().toISOString()
      });
      
      // 返回安全的默认URL
      return window.location.origin + '/';
    }
  }

  /**
   * 构建投票确认页面的返回URL
   * @param {Object} voteParams - 投票参数
   * @returns {string} 投票确认页面URL
   */
  static buildVoteReturnUrl(voteParams = {}) {
    const baseUrl = '/vote';
    const params = {
      ...voteParams,
      // 添加时间戳用于验证
      timestamp: Date.now(),
      // 添加来源标识
      source: 'registration_redirect'
    };
    
    return this.buildReturnUrl(baseUrl, params);
  }

  /**
   * 验证投票参数的有效性
   * @param {Object} voteParams - 投票参数对象
   * @returns {Object} 验证结果
   */
  static validateVoteParams(voteParams) {
    const errors = [];
    const warnings = [];

    // 检查必需的参数
    if (!voteParams.candidate_id) {
      errors.push('Missing candidate_id parameter');
    }

    if (!voteParams.candidate_name) {
      errors.push('Missing candidate_name parameter');
    }

    // 检查参数格式
    if (voteParams.candidate_id && !/^\d+$/.test(voteParams.candidate_id)) {
      errors.push('Invalid candidate_id format');
    }

    // 检查时间戳有效性（如果存在）
    if (voteParams.timestamp) {
      const timestamp = parseInt(voteParams.timestamp);
      const now = Date.now();
      const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        warnings.push('Vote parameters are older than 24 hours');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * 从当前URL获取所有查询参数
   * @returns {Object} 查询参数对象
   */
  static getCurrentUrlParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    urlParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  }

  /**
   * 检查URL是否为有效的投票页面URL
   * @param {string} url - 要检查的URL
   * @returns {boolean} 是否为有效的投票页面URL
   */
  static isValidVoteUrl(url) {
    const parsed = this.parseReturnUrl(url);
    
    if (!parsed.isValid) {
      return false;
    }

    // 检查是否为投票页面路径
    if (!parsed.pathname.startsWith('/vote')) {
      return false;
    }

    // 验证投票参数
    const voteValidation = this.validateVoteParams(parsed.searchParams);
    return voteValidation.isValid;
  }

  /**
   * 编码URL参数以防止XSS攻击
   * @param {string} param - 要编码的参数
   * @returns {string} 编码后的参数
   */
  static encodeUrlParam(param) {
    if (typeof param !== 'string') {
      param = String(param);
    }
    
    return encodeURIComponent(param)
      .replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
      });
  }

  /**
   * 解码URL参数
   * @param {string} param - 要解码的参数
   * @returns {string} 解码后的参数
   */
  static decodeUrlParam(param) {
    try {
      return decodeURIComponent(param);
    } catch (error) {
      console.error('Error decoding URL parameter:', error);
      return param; // 返回原始参数作为备用
    }
  }

  /**
   * 记录URL相关的安全事件
   * @param {string} eventType - 事件类型
   * @param {Object} details - 事件详情
   */
  static logSecurityEvent(eventType, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'url_security_event',
      eventType: eventType,
      userAgent: navigator.userAgent,
      url: window.location.href,
      details: details
    };

    console.warn('URL Security Event:', logEntry);
    
    // 可以在这里添加发送到服务器的逻辑
    // 例如：发送到审计日志端点
  }
}

// 导出工具类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = URLUtils;
} else if (typeof window !== 'undefined') {
  window.URLUtils = URLUtils;
}