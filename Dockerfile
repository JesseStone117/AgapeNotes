FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html manifest.json sw.js vite.config.mjs ./
COPY icons ./icons
COPY js ./js
COPY styles ./styles
RUN npm run build

FROM rust:1-bookworm AS backend
WORKDIR /app
COPY server/Cargo.toml ./server/Cargo.toml
COPY server/src ./server/src
WORKDIR /app/server
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=frontend /app/dist ./dist
COPY --from=backend /app/server/target/release/agapenotes-server ./agapenotes-server
ENV STATIC_DIR=/app/dist
ENV AGAPE_DB_PATH=/var/data/agapenotes.db
EXPOSE 10000
CMD ["./agapenotes-server"]
