use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

static JWT_SECRET: OnceLock<String> = OnceLock::new();

pub fn jwt_secret() -> &'static [u8] {
    JWT_SECRET
        .get_or_init(|| std::env::var("JWT_SECRET").expect("JWT_SECRET must be set"))
        .as_bytes()
}

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub role: String,
    pub exp: u64,
}
