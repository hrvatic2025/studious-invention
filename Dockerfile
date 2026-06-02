# PartyPix — production image
FROM node:20-bookworm-slim

# Build tools for native deps (better-sqlite3); sharp ships prebuilt binaries.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# App source
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
# Persist DB + uploads here (mount a volume in production)
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
