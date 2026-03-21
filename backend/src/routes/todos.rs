use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
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

fn row_to_todo(row: &rusqlite::Row) -> rusqlite::Result<Todo> {
    let status_str: String = row.get(6)?;
    let status = Status::try_from(status_str).unwrap_or(Status::Todo);
    Ok(Todo {
        id: row.get(0)?,
        title: row.get(1)?,
        category: row.get(2)?,
        user_id: row.get(3)?,
        is_recurrent: row.get::<_, i32>(4)? != 0,
        recurrency: row.get(5)?,
        status,
    })
}

const SELECT: &str =
    "SELECT id, title, category, user_id, is_recurrent, recurrency, status FROM todos";

async fn list_todos(
    State(db): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Todo>>, StatusCode> {
    let conn = db.lock().unwrap();
    let todos = if auth.is_admin() {
        let mut stmt = conn
            .prepare(SELECT)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        stmt.query_map([], row_to_todo)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        let mut stmt = conn
            .prepare(&format!("{SELECT} WHERE user_id = ?1"))
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
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_todo)
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if !auth.is_admin() && todo.user_id != Some(auth.0.sub) {
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
    let is_recurrent = payload.is_recurrent.unwrap_or(false) as i32;
    let status = payload.status.unwrap_or(Status::Todo);
    let user_id = auth.0.sub;
    conn.execute(
        "INSERT INTO todos (title, category, user_id, is_recurrent, recurrency, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            payload.title,
            payload.category,
            user_id,
            is_recurrent,
            payload.recurrency,
            status.as_str(),
        ],
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let id = conn.last_insert_rowid();
    let todo = Todo {
        id,
        title: payload.title,
        category: payload.category,
        user_id: Some(user_id),
        is_recurrent: is_recurrent != 0,
        recurrency: payload.recurrency,
        status,
    };
    Ok((StatusCode::CREATED, Json(todo)))
}

async fn update_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateTodo>,
) -> Result<Json<Todo>, StatusCode> {
    let conn = db.lock().unwrap();

    let existing = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_todo)
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if !auth.is_admin() && existing.user_id != Some(auth.0.sub) {
        return Err(StatusCode::FORBIDDEN);
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
    if let Some(v) = payload.category { update_field!("category", v); }
    if let Some(v) = payload.is_recurrent { update_field!("is_recurrent", v as i32 ); }
    if let Some(v) = payload.recurrency { update_field!("recurrency", v); }
    if let Some(v) = payload.status { update_field!("status", v.as_str()); }

    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_todo)
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_todo(
    State(db): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> StatusCode {
    let conn = db.lock().unwrap();

    let existing = conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], row_to_todo);
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
