use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    routing::{delete, get, post},
};
use serde_json::{Value, json};
use std::sync::Arc;

use crate::{
    AppState,
    extractor::AuthUser,
    models::push::{PushSubscribeRequest, PushUnsubscribeRequest},
    notify::{VapidConfig, send_push},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/vapid-public-key", get(get_public_key))
        .route("/subscribe", post(subscribe))
        .route("/subscribe", delete(unsubscribe))
        .route("/test", post(test_push))
}

async fn get_public_key(Extension(vapid): Extension<Arc<VapidConfig>>) -> Json<Value> {
    Json(json!({ "publicKey": vapid.public_key }))
}

async fn subscribe(
    State(db): State<AppState>,
    auth: AuthUser,
    Json(body): Json<PushSubscribeRequest>,
) -> Result<StatusCode, StatusCode> {
    let conn = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    conn.execute(
        "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = ?1, p256dh = ?3, auth = ?4",
        rusqlite::params![auth.0.sub, body.endpoint, body.p256dh, body.auth],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::CREATED)
}

async fn unsubscribe(
    State(db): State<AppState>,
    auth: AuthUser,
    Json(body): Json<PushUnsubscribeRequest>,
) -> Result<StatusCode, StatusCode> {
    let conn = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    conn.execute(
        "DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id = ?2",
        rusqlite::params![body.endpoint, auth.0.sub],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn test_push(
    State(db): State<AppState>,
    auth: AuthUser,
    Extension(vapid): Extension<Arc<VapidConfig>>,
) -> Result<StatusCode, StatusCode> {
    let subs: Vec<(String, String, String)> = {
        let conn = db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut stmt = conn
            .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?1")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        stmt.query_map(rusqlite::params![auth.0.sub], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect()
    };

    if subs.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    let payload = json!({
        "title": "Test notification",
        "body":  "Push notifications are working!",
        "tag":   "test",
    })
    .to_string();

    for (endpoint, p256dh, auth_key) in subs {
        if let Err(e) = send_push(&vapid, endpoint, p256dh, auth_key, &payload).await {
            eprintln!("[push/test] {e}");
        }
    }

    Ok(StatusCode::NO_CONTENT)
}
