use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};

use crate::{
    extractor::AuthUser,
    models::{AddMemberRequest, Category, CategoryMember, CreateCategory, UpdateCategory},
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_categories).post(create_category))
        .route("/{id}", put(update_category).delete(delete_category))
        .route("/{id}/members", post(add_member))
        .route("/{id}/members/{user_id}", delete(remove_member))
}

/// Load a category with its members, checking that `requesting_user` has access.
fn load_category(
    conn: &rusqlite::Connection,
    id: i64,
    requesting_user: i64,
    is_admin: bool,
) -> Result<Category, StatusCode> {
    let row: Option<(String, i64, String)> = conn
        .query_row(
            "SELECT c.name, c.owner_id, u.nickname
             FROM categories c JOIN users u ON c.owner_id = u.id
             WHERE c.id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    let (name, owner_id, owner_nickname) = row.ok_or(StatusCode::NOT_FOUND)?;

    // Access: owner, admin, or a member
    if !is_admin && owner_id != requesting_user {
        let is_member: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM category_members WHERE category_id = ?1 AND user_id = ?2",
                rusqlite::params![id, requesting_user],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;
        if !is_member {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let mut stmt = conn
        .prepare(
            "SELECT cm.user_id, u.nickname
             FROM category_members cm JOIN users u ON cm.user_id = u.id
             WHERE cm.category_id = ?1
             ORDER BY u.nickname",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let members: Vec<CategoryMember> = stmt
        .query_map([id], |row| {
            Ok(CategoryMember { user_id: row.get(0)?, nickname: row.get(1)? })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Category {
        id,
        name,
        owner_id,
        owner_nickname,
        is_shared: !members.is_empty(),
        members,
    })
}

async fn list_categories(
    State(db): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Category>>, StatusCode> {
    let conn = db.lock().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT c.id FROM categories c
             LEFT JOIN category_members cm ON c.id = cm.category_id
             WHERE c.owner_id = ?1 OR cm.user_id = ?1
             ORDER BY c.id",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ids: Vec<i64> = stmt
        .query_map([auth.0.sub], |row| row.get(0))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();

    let categories = ids
        .iter()
        .filter_map(|&id| load_category(&conn, id, auth.0.sub, auth.is_admin()).ok())
        .collect();

    Ok(Json(categories))
}

async fn create_category(
    State(db): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateCategory>,
) -> Result<(StatusCode, Json<Category>), StatusCode> {
    let name = payload.name.trim().to_lowercase();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO categories (name, owner_id) VALUES (?1, ?2)",
        rusqlite::params![name, auth.0.sub],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let id = conn.last_insert_rowid();
    let owner_nickname: String = conn
        .query_row(
            "SELECT nickname FROM users WHERE id = ?1",
            [auth.0.sub],
            |row| row.get(0),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        StatusCode::CREATED,
        Json(Category {
            id,
            name,
            owner_id: auth.0.sub,
            owner_nickname,
            is_shared: false,
            members: vec![],
        }),
    ))
}

async fn update_category(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateCategory>,
) -> Result<Json<Category>, StatusCode> {
    let name = payload.name.trim().to_lowercase();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let conn = db.lock().unwrap();
    let owner_id: i64 = conn
        .query_row("SELECT owner_id FROM categories WHERE id = ?1", [id], |row| row.get(0))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if owner_id != auth.0.sub && !auth.is_admin() {
        return Err(StatusCode::FORBIDDEN);
    }

    conn.execute(
        "UPDATE categories SET name = ?1 WHERE id = ?2",
        rusqlite::params![name, id],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    load_category(&conn, id, auth.0.sub, auth.is_admin()).map(Json)
}

async fn delete_category(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> StatusCode {
    let conn = db.lock().unwrap();
    let owner_id: i64 = match conn
        .query_row("SELECT owner_id FROM categories WHERE id = ?1", [id], |row| row.get(0))
    {
        Ok(v) => v,
        Err(_) => return StatusCode::NOT_FOUND,
    };

    if owner_id != auth.0.sub && !auth.is_admin() {
        return StatusCode::FORBIDDEN;
    }

    match conn.execute("DELETE FROM categories WHERE id = ?1", [id]) {
        Ok(0) => StatusCode::NOT_FOUND,
        Ok(_) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn add_member(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<Json<Category>, StatusCode> {
    let conn = db.lock().unwrap();
    let owner_id: i64 = conn
        .query_row("SELECT owner_id FROM categories WHERE id = ?1", [id], |row| row.get(0))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if owner_id != auth.0.sub && !auth.is_admin() {
        return Err(StatusCode::FORBIDDEN);
    }
    if payload.user_id == owner_id {
        return Err(StatusCode::BAD_REQUEST);
    }

    let user_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE id = ?1",
            [payload.user_id],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;
    if !user_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    conn.execute(
        "INSERT OR IGNORE INTO category_members (category_id, user_id) VALUES (?1, ?2)",
        rusqlite::params![id, payload.user_id],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    load_category(&conn, id, auth.0.sub, auth.is_admin()).map(Json)
}

async fn remove_member(
    State(db): State<AppState>,
    auth: AuthUser,
    Path((category_id, user_id)): Path<(i64, i64)>,
) -> StatusCode {
    let conn = db.lock().unwrap();
    let owner_id: i64 = match conn
        .query_row("SELECT owner_id FROM categories WHERE id = ?1", [category_id], |row| row.get(0))
    {
        Ok(v) => v,
        Err(_) => return StatusCode::NOT_FOUND,
    };

    // Owner can remove anyone; a member can remove themselves (leave)
    if owner_id != auth.0.sub && auth.0.sub != user_id && !auth.is_admin() {
        return StatusCode::FORBIDDEN;
    }

    match conn.execute(
        "DELETE FROM category_members WHERE category_id = ?1 AND user_id = ?2",
        rusqlite::params![category_id, user_id],
    ) {
        Ok(_) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
