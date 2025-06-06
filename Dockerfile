# Multi-stage Docker build for Ruuvi Home Lite monorepo
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

# Copy root package files for workspace dependencies
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

# Install all dependencies including workspaces
RUN npm ci

# Copy source code
COPY packages/ ./packages
COPY tsconfig.json ./

# Build packages in dependency order
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache sqlite dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ruuvi -u 1001 -G nodejs

WORKDIR /app

# Copy node_modules (includes workspace links)
COPY --from=builder /app/node_modules ./node_modules

# Copy built backend application
COPY --from=builder /app/packages/backend/dist ./

# Copy built frontend to serve as static files
COPY --from=builder /app/packages/frontend/dist ./public

# Copy configuration files
COPY --from=builder /app/packages/backend/config ./config

# Create data and logs directories
RUN mkdir -p data logs certs && \
    chown -R ruuvi:nodejs /app

# Copy environment example
COPY .env.example .env.docker

# Switch to non-root user
USER ruuvi

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
