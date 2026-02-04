# QR码动态域名/IP地址功能说明

## 功能概述

现在QR码生成系统支持动态域名/IP地址，不再使用固定的IP地址。系统会自动从当前浏览器地址栏获取域名/IP地址，并用于生成QR码。

## 主要改进

### 1. 新用户注册
- **自动获取**: 注册时自动使用当前浏览器的域名/IP地址
- **前端传递**: 前端会将 `window.location.protocol + '//' + window.location.host` 传递给后端
- **安全验证**: 只允许 http 和 https 协议

### 2. 批量更新现有QR码
- **新增API**: `/api/users/batch-update-qr`
- **批量处理**: 可以一次性更新所有用户的QR码
- **统计信息**: 返回详细的更新统计

## API接口

### 用户注册 (已更新)
```
POST /api/users/register
```

**请求参数:**
```json
{
  "name": "用户姓名",
  "gender": "male|female",
  "baseURL": "http://192.168.1.100:3000"  // 新增参数
}
```

**响应:**
```json
{
  "success": true,
  "userId": "user-id",
  "numericId": "123456",
  "name": "用户姓名",
  "gender": "male",
  "avatarUrl": "/static/images/default-male-avatar.svg",
  "qrCode": "data:image/png;base64,...",
  "qrData": "http://192.168.1.100:3000/vote/user-id",
  "baseURL": "http://192.168.1.100:3000"  // 返回使用的baseURL
}
```

### 批量更新QR码 (新增)
```
POST /api/users/batch-update-qr
```

**请求参数:**
```json
{
  "baseURL": "http://192.168.1.100:3000"
}
```

**响应:**
```json
{
  "success": true,
  "message": "QR码批量更新完成",
  "statistics": {
    "total": 10,
    "updated": 8,
    "skipped": 2,
    "errors": 0
  },
  "baseURL": "http://192.168.1.100:3000",
  "errors": []  // 如果有错误会包含详细信息
}
```

## 前端实现

### 注册时自动传递baseURL
```javascript
const currentBaseURL = `${window.location.protocol}//${window.location.host}`;

const response = await fetch('/api/users/register', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
        name, 
        gender,
        baseURL: currentBaseURL  // 自动传递当前地址
    })
});
```

### 批量更新QR码
```javascript
const response = await fetch('/api/users/batch-update-qr', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        baseURL: 'http://新的IP地址:3000'
    })
});
```

## 使用场景

### 1. 开发环境切换
- 从 localhost 切换到局域网IP
- 从一个IP地址切换到另一个IP地址
- 从HTTP切换到HTTPS

### 2. 部署环境迁移
- 测试环境到生产环境
- 不同服务器之间的迁移
- 域名变更

### 3. 网络环境变化
- 路由器IP变更
- 网络配置调整
- 多网卡环境

## 测试页面

访问 `test-qr-management.html` 可以测试以下功能：

1. **查看当前环境**: 显示当前的协议、域名、IP地址
2. **测试注册**: 创建测试用户验证动态URL功能
3. **批量更新**: 更新所有现有用户的QR码
4. **用户统计**: 查看当前用户和QR码URL分布
5. **清理测试**: 删除测试用户

## 安全考虑

### URL验证
- 只允许 `http://` 和 `https://` 协议
- 验证URL格式的有效性
- 防止恶意URL注入

### 临时环境变量
- 使用临时环境变量设置baseURL
- 操作完成后恢复原始设置
- 避免全局状态污染

## 向后兼容

- 现有的QR码仍然有效
- 旧的API调用方式仍然支持
- 如果不传递baseURL参数，使用默认配置

## 故障排除

### 常见问题

1. **QR码仍然使用旧IP**
   - 使用批量更新API更新所有QR码
   - 检查前端是否正确传递baseURL参数

2. **无效的baseURL错误**
   - 确保URL格式正确 (http://或https://)
   - 检查是否包含端口号

3. **批量更新失败**
   - 检查网络连接
   - 查看返回的错误详情
   - 确认用户权限

### 调试方法

1. 查看浏览器开发者工具的网络请求
2. 检查服务器日志
3. 使用测试页面验证功能
4. 检查数据库中的QR码数据

## 示例

### 场景1: 从localhost切换到局域网IP
```bash
# 当前在 http://localhost:3000
# 需要切换到 http://192.168.1.100:3000

# 方法1: 批量更新现有用户
curl -X POST http://localhost:3000/api/users/batch-update-qr \
  -H "Content-Type: application/json" \
  -d '{"baseURL":"http://192.168.1.100:3000"}'

# 方法2: 新用户自动使用新地址 (在192.168.1.100:3000访问时)
# 前端会自动传递正确的baseURL
```

### 场景2: 部署到生产环境
```bash
# 更新所有QR码到生产域名
curl -X POST https://your-domain.com/api/users/batch-update-qr \
  -H "Content-Type: application/json" \
  -d '{"baseURL":"https://your-domain.com"}'
```

这个功能让QR码系统更加灵活，适应不同的部署环境和网络配置。