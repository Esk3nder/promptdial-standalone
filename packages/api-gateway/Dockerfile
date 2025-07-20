# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-gateway/package.json ./packages/api-gateway/

# Install dependencies
RUN npm ci --workspace=@promptdial/shared --workspace=@promptdial/api-gateway

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api-gateway ./packages/api-gateway
COPY tsconfig.json ./

# Build
RUN npm run build --workspace=@promptdial/shared
RUN npm run build --workspace=@promptdial/api-gateway

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist
COPY --from=builder /app/packages/api-gateway/package.json ./packages/api-gateway/
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --production --workspace=@promptdial/shared --workspace=@promptdial/api-gateway

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "packages/api-gateway/dist/index.js"]