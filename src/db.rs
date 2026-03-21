use bcrypt::{hash, DEFAULT_COST};
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
    seed_admin(&conn);
    Ok(conn)
}

fn seed_admin(conn: &Connection) {
    let already_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE role = 'ADMIN'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if already_exists {
        return;
    }

    let nickname = std::env::var("ADMIN_NICKNAME").expect("ADMIN_NICKNAME must be set");
    let email = std::env::var("ADMIN_EMAIL").expect("ADMIN_EMAIL must be set");
    let password = std::env::var("ADMIN_PASSWORD").expect("ADMIN_PASSWORD must be set");
    let hashed = hash(&password, DEFAULT_COST).expect("Failed to hash admin password");

    conn.execute(
        "INSERT INTO users (nickname, email, password, role) VALUES (?1, ?2, ?3, 'ADMIN')",
        rusqlite::params![nickname, email, hashed],
    )
    .expect("Failed to seed admin user");
}
