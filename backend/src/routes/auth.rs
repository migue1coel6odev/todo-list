use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use bcrypt::verify;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use crate::{jwt::{Claims, jwt_secret}, AppState};

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/login", post(login))
}

async fn login(
    State(db): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let conn = db.lock().unwrap();
    let (id, hashed, role): (i64, String, String) = conn
        .query_row(
            "SELECT id, password, role FROM users WHERE email = ?1",
            [&payload.email],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let valid = verify(&payload.password, &hashed)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let exp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() + 24 * 3600;

    let claims = Claims { sub: id, role, exp };
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret()))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse { token }))
}
