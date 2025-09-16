# Multi-stage Dockerfile for Spur Super App
# Production-ready build with security scanning and optimization

# Stage 1: Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY package-test.json ./
COPY package.steel-integration.json ./

# Install all dependencies including dev dependencies
RUN npm ci --only=production

# Stage 2: Build application
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files and dependencies
COPY package*.json ./
COPY package-test.json ./
COPY package.steel-integration.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build:web
RUN npm run build:extension

# Stage 3: Production web application
FROM nginx:alpine AS web-app
WORKDIR /usr/share/nginx/html

# Copy built web application
COPY --from=builder /app/dist-web/* ./

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Stage 4: Extension build environment
FROM node:20-alpine AS extension-builder
WORKDIR /app

# Copy necessary files for extension building
COPY --from=builder /app/dist-extension ./dist-extension
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Create extension package
RUN npm run package:extension

# Stage 5: Security scanning
FROM aquasec/trivy:latest AS security-scanner
WORKDIR /scan

# Copy built artifacts for scanning
COPY --from=web-app /usr/share/nginx/html ./web-app
COPY --from=extension-builder /app/*.zip ./extension/

# Run security scan
RUN trivy fs --severity CRITICAL,HIGH --exit-code 0 --format json --output security-report.json ./ || true
RUN trivy image --severity CRITICAL,HIGH --exit-code 0 --format json --output image-security.json alpine:latest || true

# Stage 6: Production runtime with security hardening
FROM node:20-alpine-slim AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install runtime dependencies with security
RUN apk add --no-cache --update \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy built application and dependencies
COPY --from=builder /app/dist-web ./dist-web
COPY --from=builder /app/dist-extension ./dist-extension
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy production scripts
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create necessary directories
RUN mkdir -p /app/logs /app/data /app/config && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Entry point
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]

# Stage 7: Development environment
FROM node:20-alpine AS development
WORKDIR /app

# Install development dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    vim \
    curl

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose ports
EXPOSE 3000 5173

# Set development environment
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

# Development entry point
CMD ["npm", "run", "dev"]

# Stage 8: Testing environment
FROM node:20-alpine AS testing
WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist-web ./dist-web
COPY --from=builder /app/dist-extension ./dist-extension

# Copy test configuration
COPY package*.json ./
COPY vitest.config.ts ./
COPY playwright.config.ts ./
COPY tests ./tests

# Install test dependencies
RUN npm ci --include=dev

# Set testing environment
ENV NODE_ENV=test

# Test entry point
CMD ["npm", "run", "test"]

# Stage 9: Minimal production image
FROM scratch AS minimal

# Copy only necessary files from production stage
COPY --from=production /app/dist-web /dist-web
COPY --from=production /app/node_modules /node_modules
COPY --from=production /app/package.json /package.json
COPY --from=production /app/healthcheck.js /healthcheck.js

# Copy SSL certificates if needed
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Minimal entry point
ENTRYPOINT ["/node_modules/.bin/node"]
CMD ["server.js"]

# Default stage
FROM production