# Multi-stage build for Node.js application
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies and security updates
RUN apk add --no-cache --update curl sqlite dumb-init && \
    apk upgrade

# Create non-root user with restricted permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ruuvi -u 1001 -G nodejs -s /bin/sh -h /app

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy public files
COPY public/ ./public/

# Create data and logs directories with secure permissions
RUN mkdir -p data logs certs && \
    chown -R ruuvi:nodejs /app && \
    chmod -R 750 /app && \
    chmod 700 /app/data /app/logs /app/certs

# Switch to non-root user
USER ruuvi

# Expose port
EXPOSE 3000

# Health check with better error handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -k -f --max-time 5 --retry 2 --connect-timeout 3 https://localhost:3000/ || \
        curl -f --max-time 5 --retry 2 --connect-timeout 3 http://localhost:3000/ || exit 1

# Add security labels
LABEL security.non-root="true" \
      security.user="ruuvi:nodejs" \
      security.capabilities="none" \
      maintainer="ruuvi-home-lite"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]