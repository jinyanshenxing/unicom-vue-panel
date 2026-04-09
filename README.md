# 联通查询面板

查询联通卡速率、QCI等级、流量余量、隐藏包等信息。

## 功能

- ✅ 短信验证码登录
- ✅ ECS Token 直接登录
- ✅ 5G 速率查询（上行/下行）
- ✅ QCI 等级查询（含说明）
- ✅ 流量余量查询（带进度条）
- ✅ 已订业务查询（含隐藏包标记）
- ✅ 夜间/日间主题切换

## 部署方式

### 方式一：Node.js 直接运行

```bash
npm install
npm start
# 访问 http://localhost:3000
```

### 方式二：Docker

```bash
docker build -t unicom-panel .
docker run -d -p 3000:3000 unicom-panel
# 访问 http://localhost:3000
```

### 方式三：修改端口

```bash
PORT=8080 node server.js
```

## 文件结构

```
unicom-panel/
├── server.js          # Express 代理服务（解决跨域）
├── package.json
├── Dockerfile
└── public/
    └── index.html     # 前端页面
```

## API 端点

| 端点 | 说明 |
|------|------|
| POST /api/random-login | 初始化登录 |
| POST /api/send-sms | 发送短信验证码 |
| POST /api/verify-login | 验证码登录 |
| POST /api/ecs-login | ECS Token 登录 |
| POST /api/speed-qci | 查询5G速率和QCI |
| POST /api/flow-info | 查询流量余量 |
| POST /api/ordered-services | 查询已订业务（含隐藏包） |

## 注意事项

- 本工具仅供个人学习研究使用
- 所有请求通过服务端代理转发，解决浏览器跨域限制
- Cookie 存储在客户端内存中，刷新页面需重新登录
