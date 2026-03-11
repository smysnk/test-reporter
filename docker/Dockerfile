FROM node:22-alpine AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY config ./config
COPY scripts ./scripts
COPY packages ./packages

RUN corepack enable \
    && yarn install --immutable \
    && yarn workspace server build \
    && yarn workspace web exec next build \
    && yarn workspaces focus --production server web

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SERVER_PORT=4400 \
    WEB_PORT=3001

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/config ./config
COPY --from=build /app/packages/server ./packages/server
COPY --from=build /app/packages/web ./packages/web
COPY docker/docker-entrypoint.sh ./docker/docker-entrypoint.sh

RUN chmod +x ./docker/docker-entrypoint.sh

EXPOSE 4400 3001

ENTRYPOINT ["./docker/docker-entrypoint.sh"]
CMD ["server"]
