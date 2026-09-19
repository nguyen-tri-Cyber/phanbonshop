# ==============================================================================
# Multi-stage Dockerfile for API Gateway
# Build context must be repository root:
# docker build -f apps/api-gateway/Dockerfile -t phanbonshop-gateway:prod .
# ==============================================================================

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy root and all workspace package manifests for isolated cache
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/frontend/package.json ./apps/frontend/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/product-service/package.json ./services/product-service/
COPY services/order-service/package.json ./services/order-service/
COPY services/inventory-service/package.json ./services/inventory-service/
COPY services/customer-service/package.json ./services/customer-service/
COPY services/content-service/package.json ./services/content-service/

RUN npm ci --ignore-scripts

# Copy API Gateway source code
COPY apps/api-gateway ./apps/api-gateway

# Build monorepo packages first
RUN npm run build:packages

# Build API Gateway
RUN npm run build --workspace=@phanbonshop/api-gateway

# Stage 2: Production Minimal Runner (Non-root)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/api-gateway ./apps/api-gateway

USER node
WORKDIR /app/apps/api-gateway

EXPOSE 8080

CMD ["node", "dist/main.js"]
