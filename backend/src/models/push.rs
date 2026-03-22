use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PushSubscribeRequest {
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushUnsubscribeRequest {
    pub endpoint: String,
}
