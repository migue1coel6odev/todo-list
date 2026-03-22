mod db;
mod extractor;
mod jwt;
mod models;
mod notify;
mod routes;

use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

pub type AppState = Arc<Mutex<Connection>>;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let conn = db::init().expect("Failed to initialize database");
    let state: AppState = Arc::new(Mutex::new(conn));

    // Build VAPID config from environment
    let vapid = Arc::new(notify::VapidConfig {
        private_key: std::env::var("VAPID_PRIVATE_KEY").expect("VAPID_PRIVATE_KEY must be set"),
        public_key:  std::env::var("VAPID_PUBLIC_KEY").expect("VAPID_PUBLIC_KEY must be set"),
        subject:     std::env::var("VAPID_SUBJECT").expect("VAPID_SUBJECT must be set"),
    });

    // Spawn background notification worker
    tokio::spawn(notify::run(Arc::clone(&state), Arc::clone(&vapid)));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let serve_dir = ServeDir::new("public")
        .not_found_service(ServeFile::new("public/index.html"));

    let app = axum::Router::new()
        .nest("/auth",       routes::auth::router())
        .nest("/todos",      routes::todos::router())
        .nest("/users",      routes::users::router())
        .nest("/categories", routes::categories::router())
        .nest("/push",       routes::push::router())
        .fallback_service(serve_dir)
        .layer(axum::Extension(vapid))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on port 3000");
    axum::serve(listener, app).await.unwrap();
}
