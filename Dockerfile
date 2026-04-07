# ---------- 构建前端 ----------
FROM node:20-alpine AS web-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm install

COPY web/ ./
RUN npm run build

# ---------- 构建后端 ----------
FROM node:20-alpine AS app
WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/ ./

# 复制前端构建产物
COPY --from=web-builder /app/web/dist ./public

EXPOSE 3000

ENV PORT=3000
CMD ["node", "index.js"]