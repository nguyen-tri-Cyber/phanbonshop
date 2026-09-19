# ==============================================================================
# Multi-stage Dockerfile for Content Service
# Build context must be repository root:
# docker build -f services/content-service/Dockerfile -t phanbonshop-content:prod .
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

COPY services/content-service ./services/content-service

# Build monorepo packages first
RUN npm run build:packages

# Generate Prisma Client
RUN npx prisma generate --schema=services/content-service/prisma/schema.prisma

# Build Content Service
RUN npm run build --workspace=@phanbonshop/content-service

# Stage 2: Production Minimal Runner (Non-root)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/services/content-service ./services/content-service

USER node
WORKDIR /app/services/content-service

EXPOSE 3006

CMD ["node", "dist/main.js"]
