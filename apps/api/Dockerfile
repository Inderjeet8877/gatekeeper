# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
# ponytail: ships full node_modules (incl. dev deps) because start-up runs the prisma CLI and the tsx seed;
# prune + precompile the seed if image size ever matters.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY prisma ./prisma
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 4000
# Seed runs unless SEED_ON_START=false; when SEED_ON_START is unset it defaults to on outside production.
CMD ["sh", "-c", "set -e; npx prisma migrate deploy; S=${SEED_ON_START:-$NODE_ENV}; if [ \"$S\" != false ] && [ \"$S\" != production ]; then npx prisma db seed; fi; exec node dist/index.js"]
