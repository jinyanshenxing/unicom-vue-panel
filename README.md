# 联通余量面板

查询联通手机号的**流量余量**、**5G 速率 / QCI**、**已订业务**。  
支持短信验证码登录 & ECS Token 直接登录。

[![Build & Publish Docker Image](https://github.com/YOUR_USERNAME/unicom-panel/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/YOUR_USERNAME/unicom-panel/actions/workflows/docker-publish.yml)

---

## 特性

- 🔐 短信验证码登录 / ECS Token 直接登录
- 📊 流量余量总览 + 各流量包进度条明细
- 📡 5G 速率、QCI 等级、限速状态查询
- 📋 已订业务列表
- 🌙 自动跟随系统深色模式
- 🚀 纯 Node.js 内置模块，**零外部依赖**
- 🐳 GitHub Actions 自动构建并推送 Docker 镜像（amd64 + arm64）

---

## 目录结构

```
unicom-panel/
├── frontend/                  # 纯静态前端
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/                   # Node.js 反向代理（零依赖）
│   ├── server.js
│   └── package.json
├── .github/
│   └── workflows/
│       └── docker-publish.yml # CI/CD：自动构建 & 推送镜像
├── Dockerfile
├── .dockerignore
└── README.md
```

---

## 发布到 GitHub & 自动构建镜像

### 1. 创建 GitHub 仓库并推送代码

```bash
git init
git add .
git commit -m "init: unicom panel"
git remote add origin https://github.com/YOUR_USERNAME/unicom-panel.git
git push -u origin main
```

### 2. 配置仓库 Secrets（可选：推送到 Docker Hub）

在 GitHub 仓库 → **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称         | 说明                       |
|---------------------|---------------------------|
| `DOCKERHUB_USERNAME`| Docker Hub 用户名          |
| `DOCKERHUB_TOKEN`   | Docker Hub Access Token   |

> 不配置 Docker Hub Secrets 也没关系，镜像会自动推送到 **GHCR（GitHub Container Registry）**，完全免费。

### 3. 触发构建

推送到 `main` 分支或打 Tag 时自动触发：

```bash
# 推送 main → 构建 latest 镜像
git push origin main

# 打 Tag → 构建版本镜像（v1.0.0 / 1.0.0 / 1.0）
git tag v1.0.0
git push origin v1.0.0
```

构建完成后，镜像地址为：

```
# GitHub Container Registry（公开仓库免费）
ghcr.io/YOUR_USERNAME/unicom-panel:latest

# Docker Hub（如果配置了 Secrets）
YOUR_DOCKERHUB_USERNAME/unicom-panel:latest
```

---

## 部署使用

### 方式一：Docker 直接运行

```bash
# 从 GHCR 拉取（将 YOUR_USERNAME 替换为你的 GitHub 用户名）
docker run -d \
  --name unicom-panel \
  --restart unless-stopped \
  -p 3000:3000 \
  ghcr.io/YOUR_USERNAME/unicom-panel:latest

# 自定义端口（映射到宿主机 8080）
docker run -d \
  --name unicom-panel \
  --restart unless-stopped \
  -p 8080:3000 \
  ghcr.io/YOUR_USERNAME/unicom-panel:latest
```

访问 http://your-server-ip:3000

### 方式二：docker-compose

创建 `docker-compose.yml`：

```yaml
services:
  unicom-panel:
    image: ghcr.io/YOUR_USERNAME/unicom-panel:latest
    container_name: unicom-panel
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
```

```bash
docker compose up -d
docker compose logs -f
```

### 方式三：本地直接运行（需 Node.js 18+）

```bash
# 后端直接启动（零 npm install）
node backend/server.js

# 自定义端口
PORT=8080 node backend/server.js
```

---

## Nginx 反向代理配置参考

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## ECS Token 获取方法

1. 打开 Chrome，访问 `https://m.client.10010.com` 并登录
2. 按 **F12** 打开开发者工具
3. 进入 **Application → Cookies → https://m.client.10010.com**
4. 找到 `ecs_token` 字段，复制其值
5. 粘贴到面板的「ECS Token 登录」输入框

---

## 接口说明

| 本地路径 | 联通上游接口 | 说明 |
|---|---|---|
| POST /api/send-sms   | /mobileService/sendRadomNum.htm | 发送短信验证码 |
| POST /api/login-sms  | /mobileService/radomLogin.htm | 短信验证码登录 |
| POST /api/flow       | /servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune | 流量余量查询 |
| POST /api/speed      | /servicebusiness/query/fiveg/getbasicdata | 速率 & QCI 查询 |
| POST /api/biz        | /servicebusiness/newOrdered/queryOrderRelationship | 已订业务查询 |

---

## 声明

本项目仅供个人学习使用，调用的均为联通官方接口，不存储任何用户数据，请勿用于商业用途或批量请求。
