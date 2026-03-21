use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Admin,
    User,
}

impl UserRole {
    pub fn as_str(&self) -> &str {
        match self {
            UserRole::Admin => "ADMIN",
            UserRole::User => "USER",
        }
    }
}

impl TryFrom<String> for UserRole {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.as_str() {
            "ADMIN" => Ok(UserRole::Admin),
            "USER" => Ok(UserRole::User),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }
}

#[derive(Serialize)]
pub struct User {
    pub id: i64,
    pub nickname: String,
    pub email: String,
    pub role: UserRole,
}

#[derive(Deserialize)]
pub struct CreateUser {
    pub nickname: String,
    pub email: String,
    pub password: String,
    pub role: Option<UserRole>,
}

#[derive(Deserialize)]
pub struct UpdateUser {
    pub nickname: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
    pub role: Option<UserRole>,
}
