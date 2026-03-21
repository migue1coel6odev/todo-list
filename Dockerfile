FROM rust:slim-bookworm AS builder

WORKDIR /app

# Cache dependencies separately from source
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY backend/src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/target/release/todo-list .

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["./todo-list"]
