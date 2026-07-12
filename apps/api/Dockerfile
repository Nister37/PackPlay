FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
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
