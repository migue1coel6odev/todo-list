use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Status {
    Todo,
    Done,
    OnHold,
    Blocked,
}

impl Status {
    pub fn as_str(&self) -> &str {
        match self {
            Status::Todo => "TODO",
            Status::Done => "DONE",
            Status::OnHold => "ON_HOLD",
            Status::Blocked => "BLOCKED",
        }
    }
}

impl TryFrom<String> for Status {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.as_str() {
            "TODO" => Ok(Status::Todo),
            "DONE" => Ok(Status::Done),
            "ON_HOLD" => Ok(Status::OnHold),
            "BLOCKED" => Ok(Status::Blocked),
            _ => Err(format!("Unknown status: {}", s)),
        }
    }
}

#[derive(Serialize)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub category: Option<String>,
    pub user_id: Option<i64>,
    pub is_recurrent: bool,
    pub recurrency: Option<String>,
    pub status: Status,
}

#[derive(Deserialize)]
pub struct CreateTodo {
    pub title: String,
    pub category: Option<String>,
    pub user_id: Option<i64>,
    pub is_recurrent: Option<bool>,
    pub recurrency: Option<String>,
    pub status: Option<Status>,
}

#[derive(Deserialize)]
pub struct UpdateTodo {
    pub title: Option<String>,
    pub category: Option<String>,
    pub user_id: Option<i64>,
    pub is_recurrent: Option<bool>,
    pub recurrency: Option<String>,
    pub status: Option<Status>,
}
