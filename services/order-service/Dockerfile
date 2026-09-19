# ==============================================================================
# Multi-stage Dockerfile for Order Service
# Build context must be repository root:
# docker build -f services/order-service/Dockerfile -t phanbonshop-order:prod .
# ==============================================================================

# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package manifests
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

COPY services/order-service ./services/order-service

# Build monorepo packages first
RUN npm run build:packages

# Generate Prisma Client
RUN npx prisma generate --schema=services/order-service/prisma/schema.prisma

# Build Order Service
RUN npm run build --workspace=@phanbonshop/order-service

# Stage 2: Production Minimal Runner (Non-root)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/services/order-service ./services/order-service

USER node
WORKDIR /app/services/order-service

EXPOSE 3003

CMD ["node", "dist/main.js"]
