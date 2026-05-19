FROM node:22-slim AS deps
WORKDIR /bot
COPY package*.json ./
RUN npm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /bot
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /bot/dist ./dist
COPY README.md Spec.md spec.md acceptance-tests.md ./
COPY bin ./bin
EXPOSE 3000
CMD ["node", "dist/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -fsS http://127.0.0.1:${PORT}/health >/dev/null || exit 1
