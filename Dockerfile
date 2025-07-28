# PromptDial Core Service - Production Dockerfile
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared
COPY tsconfig.json ./
COPY public ./public

# Build the application
WORKDIR /app/packages/core
RUN npm run build

# Production stage
FROM node:18-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/shared/package*.json ./packages/shared/

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Change to core directory
WORKDIR /app/packages/core

# Start the server
CMD ["node", "dist/server.js"]