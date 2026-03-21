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
];

pub fn init() -> rusqlite::Result<Connection> {
    let mut conn = Connection::open("todos.db")?;
    Migrations::new(MIGRATIONS.to_vec())
        .to_latest(&mut conn)
        .expect("Failed to run migrations");
    Ok(conn)
}
