mod db;
mod models;
mod routes;

use std::sync::{Arc, Mutex};
use rusqlite::Connection;

pub type AppState = Arc<Mutex<Connection>>;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    tracing_subscriber::fmt::init();

    let conn = db::init().expect("Failed to initialize database");
    let state: AppState = Arc::new(Mutex::new(conn));

    let app = axum::Router::new()
        .nest("/todos", routes::todos::router())
        .nest("/users", routes::users::router())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Listening on port 3000");
    axum::serve(listener, app).await.unwrap();
}
