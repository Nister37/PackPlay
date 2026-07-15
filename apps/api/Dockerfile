FROM node:22-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (root monorepo package.json)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source
COPY tsconfig.base.json nx.json jest.preset.js ./
COPY prisma ./prisma
COPY libs ./libs
COPY apps/api ./apps/api

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npx nx build api

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]
