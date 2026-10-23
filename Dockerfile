# ORATOR · Agent Commander: one Node process, the Vite-built UI plus server.ts (Express, the engine, the MCP gateway).

FROM node:22-slim AS build
WORKDIR /app
# The project's lockfile is bun.lock; npm installs from package.json's ranges.
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    COMMANDER_DATA_DIR=/data
WORKDIR /app
# The server runs through tsx, a devDependency, so node_modules comes across whole.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/tsconfig.json /app/server.ts /app/COMMANDER_SOUL.md ./
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
# Created and chowned before VOLUME, so a fresh volume is writable by the unprivileged user.
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "server.ts"]
