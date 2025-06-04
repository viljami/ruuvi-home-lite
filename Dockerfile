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

# Install runtime dependencies
RUN apk add --no-cache curl sqlite

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ruuvi -u 1001 -G nodejs

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

# Create data and logs directories
RUN mkdir -p data logs certs && \
    chown -R ruuvi:nodejs /app

# Switch to non-root user
USER ruuvi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -k -f https://localhost:3000/manifest.json || exit 1

# Start application
CMD ["node", "dist/server.js"]