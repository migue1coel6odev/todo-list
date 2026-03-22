use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use bcrypt::{hash, DEFAULT_COST};
use serde::Serialize;

use crate::{
    extractor::AuthUser,
    models::{CreateUser, UpdateUser, User, UserRole},
    AppState,
};

#[derive(Serialize)]
struct RosterEntry {
    id: i64,
    nickname: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_users).post(create_user))
        // /roster must be registered before /{id} so the literal path wins
        .route("/roster", get(user_roster))
        .route("/{id}", get(get_user).put(update_user).delete(delete_user))
}

fn row_to_user(row: &rusqlite::Row) -> rusqlite::Result<User> {
    let role_str: String = row.get(3)?;
    let role = UserRole::try_from(role_str).unwrap_or(UserRole::User);
    Ok(User {
        id: row.get(0)?,
        nickname: row.get(1)?,
        email: row.get(2)?,
        role,
    })
}

const SELECT: &str = "SELECT id, nickname, email, role FROM users";

async fn list_users(
    State(db): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<User>>, StatusCode> {
    if !auth.is_admin() {
        return Err(StatusCode::FORBIDDEN);
    }
    let conn = db.lock().unwrap();
    let mut stmt = conn
        .prepare(SELECT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let users = stmt
        .query_map([], row_to_user)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();
    Ok(Json(users))
}

async fn get_user(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<User>, StatusCode> {
    if !auth.is_admin() && auth.0.sub != id {
        return Err(StatusCode::FORBIDDEN);
    }
    let conn = db.lock().unwrap();
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_user)
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn create_user(
    State(db): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateUser>,
) -> Result<(StatusCode, Json<User>), StatusCode> {
    let role = payload.role.unwrap_or(UserRole::User);

    if matches!(role, UserRole::Admin) && !auth.is_admin() {
        return Err(StatusCode::FORBIDDEN);
    }

    let hashed = hash(&payload.password, DEFAULT_COST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO users (nickname, email, password, role) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![payload.nickname, payload.email, hashed, role.as_str()],
    )
    .map_err(|_| StatusCode::CONFLICT)?;
    let id = conn.last_insert_rowid();
    let user = User { id, nickname: payload.nickname, email: payload.email, role };
    Ok((StatusCode::CREATED, Json(user)))
}

async fn update_user(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateUser>,
) -> Result<Json<User>, StatusCode> {
    if !auth.is_admin() && auth.0.sub != id {
        return Err(StatusCode::FORBIDDEN);
    }

    if matches!(payload.role, Some(UserRole::Admin)) && !auth.is_admin() {
        return Err(StatusCode::FORBIDDEN);
    }

    let conn = db.lock().unwrap();
    macro_rules! update_field {
        ($field:expr, $value:expr) => {
            conn.execute(
                &format!("UPDATE users SET {} = ?1 WHERE id = ?2", $field),
                rusqlite::params![$value, id],
            )
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        };
    }
    if let Some(v) = payload.nickname { update_field!("nickname", v); }
    if let Some(v) = payload.email { update_field!("email", v); }
    if let Some(v) = payload.password {
        let hashed = hash(&v, DEFAULT_COST)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        update_field!("password", hashed);
    }
    if let Some(v) = payload.role { update_field!("role", v.as_str()); }

    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_user)
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_user(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> StatusCode {
    if !auth.is_admin() {
        return StatusCode::FORBIDDEN;
    }
    let conn = db.lock().unwrap();
    match conn.execute("DELETE FROM users WHERE id = ?1", [id]) {
        Ok(0) => StatusCode::NOT_FOUND,
        Ok(_) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

/// Minimal user list accessible to any authenticated user — used for category member search.
async fn user_roster(
    State(db): State<AppState>,
    _auth: AuthUser,
) -> Result<Json<Vec<RosterEntry>>, StatusCode> {
    let conn = db.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, nickname FROM users ORDER BY nickname")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let entries = stmt
        .query_map([], |row| Ok(RosterEntry { id: row.get(0)?, nickname: row.get(1)? }))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();
    Ok(Json(entries))
}
