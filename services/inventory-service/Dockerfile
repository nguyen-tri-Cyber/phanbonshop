# ==============================================================================
# Multi-stage Dockerfile for Inventory Service
# Build context must be repository root:
# docker build -f services/inventory-service/Dockerfile -t phanbonshop-inventory:prod .
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

COPY services/inventory-service ./services/inventory-service

# Build monorepo packages first
RUN npm run build:packages

# Generate Prisma Client
RUN npx prisma generate --schema=services/inventory-service/prisma/schema.prisma

# Build Inventory Service
RUN npm run build --workspace=@phanbonshop/inventory-service

# Stage 2: Production Minimal Runner (Non-root)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/services/inventory-service ./services/inventory-service

USER node
WORKDIR /app/services/inventory-service

EXPOSE 3004

CMD ["node", "dist/main.js"]
