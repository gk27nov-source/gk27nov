# Stage 1: Build the client and server bundles
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./

# Clean install all dependencies (including devDependencies for vite build and esbuild)
RUN npm ci

# Copy project source files
COPY . .

# Run production build (vite build + esbuild bundling server.ts to dist/server.cjs)
RUN npm run build

# Stage 2: Production runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled distribution artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Document ports (port 3000 for AI Studio/local, 8080 for Cloud Run)
EXPOSE 3000 8080

# Start compiled CommonJS production server
CMD ["node", "dist/server.cjs"]
