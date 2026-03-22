use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct CategoryMember {
    pub user_id: i64,
    pub nickname: String,
}

#[derive(Serialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub owner_id: i64,
    pub owner_nickname: String,
    pub is_shared: bool,
    pub members: Vec<CategoryMember>,
}

#[derive(Deserialize)]
pub struct CreateCategory {
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpdateCategory {
    pub name: String,
}

#[derive(Deserialize)]
pub struct AddMemberRequest {
    pub user_id: i64,
}
