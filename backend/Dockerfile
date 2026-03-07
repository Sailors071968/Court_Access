# ============================================
# Court Access — Backend Dockerfile
# Phase 33: Production Deployment
# ============================================

FROM node:20-alpine AS base

WORKDIR /app

# Install ClamAV client tools (for virus scanning)
RUN apk add --no-cache tini

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy source
COPY src/ ./src/
COPY .env.example ./.env.example

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start server
CMD ["node", "src/server.js"]
