FROM node:22-bookworm-slim as base
RUN apt-get update && apt-get install -y libc6 wget python3 make g++ && apt-get clean

FROM base as shared
WORKDIR /app
RUN npm install -g pnpm
ENV PNPM_HOME=/app/.pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM shared as builder
COPY . .
RUN pnpm install
RUN pnpm build

FROM base as runner
WORKDIR /app
COPY --from=builder --chown=node:node /app/build /app/build
COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/package.json /app/package.json
USER node
CMD node /app/build/main.js