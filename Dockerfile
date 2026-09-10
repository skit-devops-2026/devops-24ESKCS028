FROM node:20-alpine

WORKDIR /app

# Copy dependency definition
COPY package.json ./

# Copy application source and assets
COPY server.js ./
COPY index.html ./
COPY login.html ./
COPY register.html ./
COPY profile.html ./
COPY style.css ./
COPY app.js ./
COPY auth.js ./

EXPOSE 5500

ENV PORT=5500

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5500/health || exit 1

CMD ["node", "server.js"]
