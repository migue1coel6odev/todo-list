use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

const MIGRATIONS: &[M] = &[
    M::up(
        "CREATE TABLE todos (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT    NOT NULL,
            category     TEXT,
            user_id      INTEGER,
            is_recurrent INTEGER NOT NULL DEFAULT 0,
            recurrency   TEXT,
            status       TEXT    NOT NULL DEFAULT 'TODO'
        );",
    ),
    M::up(
        "CREATE TABLE users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT    NOT NULL UNIQUE,
            email    TEXT    NOT NULL UNIQUE,
            password TEXT    NOT NULL,
            role     TEXT    NOT NULL DEFAULT 'USER'
        );",
    ),
];

pub fn init() -> rusqlite::Result<Connection> {
    let mut conn = Connection::open("todos.db")?;
    Migrations::new(MIGRATIONS.to_vec())
        .to_latest(&mut conn)
        .expect("Failed to run migrations");
    Ok(conn)
}
