# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

# 系统依赖
RUN apk add --no-cache python3 make g++

# 依赖安装
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 复制代码
COPY . .

# 构建（最简稳定）
RUN npm run build

# 部署阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]