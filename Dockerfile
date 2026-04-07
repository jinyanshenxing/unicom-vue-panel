# ─────────────────────────────────────────────
# Stage 1 — 汇总阶段（把前端放到 backend/public）
# ─────────────────────────────────────────────
FROM node:20-alpine AS assembler

WORKDIR /app

# 复制后端代码
COPY backend/package.json ./package.json
COPY backend/server.js    ./server.js

# 复制前端静态文件到 public/
COPY frontend/             ./public/

# ─────────────────────────────────────────────
# Stage 2 — 运行阶段（精简镜像）
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

LABEL org.opencontainers.image.title="unicom-panel"
LABEL org.opencontainers.image.description="联通流量余量面板"
LABEL org.opencontainers.image.source="https://github.com/YOUR_USERNAME/unicom-panel"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

# 从 assembler 阶段复制完整应用
COPY --from=assembler --chown=appuser:appgroup /app ./

USER appuser

EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1

CMD ["node", "server.js"]
