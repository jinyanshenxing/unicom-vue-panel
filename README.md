# 余量面板 · 联通查询

> 查询联通卡速率、QCI 及隐藏流量包的前端面板，基于 Vue 3 + Vite + Tailwind CSS 构建。

[![Build & Push Docker Image](https://github.com/YOUR_USERNAME/unicom-panel/actions/workflows/docker.yml/badge.svg)](https://github.com/YOUR_USERNAME/unicom-panel/actions/workflows/docker.yml)

---

## ✨ 功能

- 📶 **速率 & QCI 查询** — 实时查看当前 5G 速率与 QCI 等级
- 📦 **流量包余量** — 支持查看普通流量包及隐藏流量包
- 📋 **已订业务** — 列出当前账号所有已订阅业务
- 🔐 **两种登录方式** — 短信验证码 / ECS Token 直接登录
- 🌙 **暗色主题** — 极简工业风设计
- 🐳 **Docker 一键部署** — 内置 Nginx 反向代理，无需额外配置

---

## 🚀 快速部署

### Docker（推荐）

```bash
# 从 GHCR 拉取最新镜像
docker run -d --rm -p 8080:80 ghcr.io/YOUR_USERNAME/unicom-panel:latest
```

访问 `http://localhost:8080` 即可使用。

### docker-compose

```yaml
version: '3.8'
services:
  unicom-panel:
    image: ghcr.io/YOUR_USERNAME/unicom-panel:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## 🛠 本地开发

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/unicom-panel.git
cd unicom-panel

# 安装依赖（推荐 pnpm）
pnpm install
# 或 npm install

# 启动开发服务器（已配置代理，自动转发联通接口）
pnpm dev
```

---

## 🔑 登录说明

### 短信验证码登录
填写手机号 → 获取验证码 → 登录

### ECS Token 登录
1. 在手机上打开联通 App，进入任意页面
2. 使用抓包工具（如 Charles、Surge、mitmproxy）捕获请求
3. 在请求头中找到 `ecs_token` 字段，复制其值
4. 填入 Token 登录界面即可

---

## 📦 GitHub Actions 自动构建

推送到 `main` 分支或打 Tag 后，GitHub Actions 会自动：

1. 使用多阶段 Dockerfile 构建前端（Node 20）
2. 用 Nginx 打包为生产镜像
3. 推送到 **GitHub Container Registry (GHCR)**，支持 `amd64` + `arm64`

**镜像地址：**
```
ghcr.io/YOUR_USERNAME/unicom-panel:latest
ghcr.io/YOUR_USERNAME/unicom-panel:v1.0.0   # 打 tag 后自动生成
```

---

## 📡 使用到的接口

| 用途 | 接口 |
|------|------|
| 发送验证码 | `POST /mobileService/sendRadomNum.htm` |
| 短信登录 | `POST /mobileService/radomLogin.htm` |
| 速率 & QCI | `POST /servicebusiness/query/fiveg/getbasicdata` |
| 流量余量 | `POST /servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune` |
| 已订业务 | `POST /servicebusiness/newOrdered/queryOrderRelationship` |

> 所有接口通过 Nginx 反向代理转发，已处理跨域问题。

---

## ⚠️ 免责声明

本项目仅供个人学习与研究使用，请勿滥用接口或用于商业目的。
