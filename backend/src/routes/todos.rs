use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::Local;

use crate::{
    extractor::AuthUser,
    models::{CreateTodo, Status, Todo, UpdateTodo},
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_todos).post(create_todo))
        .route("/{id}", get(get_todo).put(update_todo).delete(delete_todo))
}

// Columns:  0=id  1=title  2=category_id  3=category_name  4=category_owner_id
//           5=category_is_shared  6=user_id  7=is_recurrent  8=status
//           9=recurrency  10=last_completed_date
const SELECT: &str =
    "SELECT t.id, t.title, t.category_id, c.name, c.owner_id,
            (SELECT COUNT(*) FROM category_members WHERE category_id = t.category_id),
            t.user_id, t.is_recurrent, t.status, t.recurrency, t.last_completed_date
     FROM todos t
     LEFT JOIN categories c ON t.category_id = c.id";

fn row_to_todo(row: &rusqlite::Row) -> rusqlite::Result<Todo> {
    let status_str: String = row.get(8)?;
    let status = Status::try_from(status_str).unwrap_or(Status::Todo);
    let shared_count: i32 = row.get(5)?;
    Ok(Todo {
        id: row.get(0)?,
        title: row.get(1)?,
        category_id: row.get(2)?,
        category_name: row.get(3)?,
        category_owner_id: row.get(4)?,
        category_is_shared: shared_count > 0,
        user_id: row.get(6)?,
        is_recurrent: row.get::<_, i32>(7)? != 0,
        status,
        recurrency: row.get(9)?,
        last_completed_date: row.get(10)?,
    })
}

/// Returns true if the user is allowed to read a todo (owns it, owns its category,
/// or is a member of its category).
fn is_accessible(
    conn: &rusqlite::Connection,
    todo_id: i64,
    user_id: i64,
    is_admin: bool,
) -> bool {
    if is_admin {
        return true;
    }
    conn.query_row(
        "SELECT COUNT(*) FROM todos t
         LEFT JOIN categories c ON t.category_id = c.id
         LEFT JOIN category_members cm ON c.id = cm.category_id AND cm.user_id = ?2
         WHERE t.id = ?1
           AND (t.user_id = ?2 OR c.owner_id = ?2 OR cm.user_id IS NOT NULL)",
        rusqlite::params![todo_id, user_id],
        |row| row.get::<_, i32>(0),
    )
    .unwrap_or(0)
        > 0
}

/// Returns true if the user may create/move a todo into the given category.
fn has_category_access(
    conn: &rusqlite::Connection,
    category_id: i64,
    user_id: i64,
    is_admin: bool,
) -> bool {
    if is_admin {
        return true;
    }
    conn.query_row(
        "SELECT COUNT(*) FROM categories c
         LEFT JOIN category_members cm ON c.id = cm.category_id AND cm.user_id = ?2
         WHERE c.id = ?1 AND (c.owner_id = ?2 OR cm.user_id IS NOT NULL)",
        rusqlite::params![category_id, user_id],
        |row| row.get::<_, i32>(0),
    )
    .unwrap_or(0)
        > 0
}

async fn list_todos(
    State(db): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Todo>>, StatusCode> {
    let conn = db.lock().unwrap();

    let todos = if auth.is_admin() {
        let mut stmt = conn
            .prepare(&format!("{SELECT} ORDER BY t.id"))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        stmt.query_map([], row_to_todo)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        let mut stmt = conn
            .prepare(&format!(
                "{SELECT}
                 WHERE t.user_id = ?1
                    OR t.category_id IN (SELECT id FROM categories WHERE owner_id = ?1)
                    OR t.category_id IN (SELECT category_id FROM category_members WHERE user_id = ?1)
                 ORDER BY t.id"
            ))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        stmt.query_map([auth.0.sub], row_to_todo)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .filter_map(|r| r.ok())
            .collect()
    };

    Ok(Json(todos))
}

async fn get_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> Result<Json<Todo>, StatusCode> {
    let conn = db.lock().unwrap();
    let todo = conn
        .query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], row_to_todo)
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if !is_accessible(&conn, id, auth.0.sub, auth.is_admin()) {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(todo))
}

async fn create_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<CreateTodo>,
) -> Result<(StatusCode, Json<Todo>), StatusCode> {
    let conn = db.lock().unwrap();

    if let Some(cat_id) = payload.category_id {
        if !has_category_access(&conn, cat_id, auth.0.sub, auth.is_admin()) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let is_recurrent = payload.is_recurrent.unwrap_or(false) as i32;
    let status = payload.status.unwrap_or(Status::Todo);
    let user_id = auth.0.sub;

    conn.execute(
        "INSERT INTO todos (title, category_id, user_id, is_recurrent, recurrency, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            payload.title,
            payload.category_id,
            user_id,
            is_recurrent,
            payload.recurrency,
            status.as_str(),
        ],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let id = conn.last_insert_rowid();
    conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], row_to_todo)
        .map(|todo| (StatusCode::CREATED, Json(todo)))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateTodo>,
) -> Result<Json<Todo>, StatusCode> {
    let conn = db.lock().unwrap();

    let existing = conn
        .query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], row_to_todo)
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if !auth.is_admin() && existing.user_id != Some(auth.0.sub) {
        return Err(StatusCode::FORBIDDEN);
    }

    if let Some(cat_id) = payload.category_id {
        if !has_category_access(&conn, cat_id, auth.0.sub, auth.is_admin()) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    macro_rules! update_field {
        ($field:expr, $value:expr) => {
            conn.execute(
                &format!("UPDATE todos SET {} = ?1 WHERE id = ?2", $field),
                rusqlite::params![$value, id],
            )
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        };
    }

    if let Some(v) = payload.title { update_field!("title", v); }
    if let Some(v) = payload.category_id { update_field!("category_id", v); }
    if let Some(v) = payload.is_recurrent { update_field!("is_recurrent", v as i32); }
    if let Some(v) = payload.recurrency { update_field!("recurrency", v); }

    if let Some(ref v) = payload.status {
        if existing.is_recurrent {
            match v {
                Status::Done => {
                    // Record completion date (task resets when the cron fires again)
                    let today = Local::now().format("%Y-%m-%d").to_string();
                    conn.execute(
                        "UPDATE todos SET status = 'DONE', last_completed_date = ?1 WHERE id = ?2",
                        rusqlite::params![today, id],
                    )
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                }
                Status::Todo => {
                    // User manually un-completed: clear the completion date
                    conn.execute(
                        "UPDATE todos SET status = 'TODO', last_completed_date = NULL WHERE id = ?1",
                        [id],
                    )
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                }
                _ => { update_field!("status", v.as_str()); }
            }
        } else {
            update_field!("status", v.as_str());
        }
    }

    conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], row_to_todo)
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> StatusCode {
    let conn = db.lock().unwrap();

    let existing = conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], row_to_todo);
    match existing {
        Err(_) => return StatusCode::NOT_FOUND,
        Ok(todo) if !auth.is_admin() && todo.user_id != Some(auth.0.sub) => {
            return StatusCode::FORBIDDEN;
        }
        _ => {}
    }

    match conn.execute("DELETE FROM todos WHERE id = ?1", [id]) {
        Ok(0) => StatusCode::NOT_FOUND,
        Ok(_) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
