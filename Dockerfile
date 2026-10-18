# Krishi Clinic: zero-dependency Node.js server serving the frontend,
# /health, /metrics and the /api/analyze proxy.
FROM node:20-alpine

ARG COMMIT_SHA=unknown
ENV NODE_ENV=production \
    PORT=5500 \
    COMMIT_SHA=${COMMIT_SHA}

WORKDIR /app

# Dependencies first so this layer is cached when only source changes.
# (There are no runtime dependencies today, but this keeps the habit.)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Only what the server needs at runtime; see .dockerignore
COPY server.js app.js auth.js style.css index.html login.html register.html profile.html ./

# Run as the unprivileged user that ships with the node image
USER node

EXPOSE 5500

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5500/health || exit 1

CMD ["node", "server.js"]
