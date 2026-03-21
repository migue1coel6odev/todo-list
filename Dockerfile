# Stage 1: Build Rust backend
FROM rust:slim-bookworm AS rust-builder

WORKDIR /app

COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY backend/src ./src
RUN touch src/main.rs && cargo build --release

# Stage 2: Build frontend
FROM oven/bun:latest AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# Stage 3: Final image
FROM debian:bookworm-slim

WORKDIR /app

COPY --from=rust-builder /app/target/release/todo-list .
COPY --from=frontend-builder /app/dist ./public

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["./todo-list"]
