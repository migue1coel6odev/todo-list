mod db;
mod extractor;
mod jwt;
mod models;
mod routes;

use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use tower_http::cors::{CorsLayer, Any};
use tower_http::services::{ServeDir, ServeFile};

pub type AppState = Arc<Mutex<Connection>>;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let conn = db::init().expect("Failed to initialize database");
    let state: AppState = Arc::new(Mutex::new(conn));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let serve_dir = ServeDir::new("public")
        .not_found_service(ServeFile::new("public/index.html"));

    let app = axum::Router::new()
        .nest("/auth", routes::auth::router())
        .nest("/todos", routes::todos::router())
        .nest("/users", routes::users::router())
        .fallback_service(serve_dir)
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on port 3000");
    axum::serve(listener, app).await.unwrap();
}
