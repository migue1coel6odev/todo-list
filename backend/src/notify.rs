use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use chrono::{Datelike, Local, Timelike};
use rusqlite::Connection;
use tokio::time::{Duration, interval};
use web_push::{
    ContentEncoding, IsahcWebPushClient, SubscriptionInfo, SubscriptionKeys,
    VapidSignatureBuilder, WebPushClient, WebPushMessageBuilder,
};

pub struct VapidConfig {
    pub private_key: String,
    pub public_key: String,
    pub subject: String,
}

/// Send a single push notification. Shared by the background worker and the test endpoint.
pub async fn send_push(
    vapid: &VapidConfig,
    endpoint: String,
    p256dh: String,
    auth: String,
    payload: &str,
) -> Result<(), String> {
    let client = IsahcWebPushClient::new().map_err(|e| e.to_string())?;
    let sub = SubscriptionInfo {
        endpoint,
        keys: SubscriptionKeys { p256dh, auth },
    };

    let mut sig_builder =
        VapidSignatureBuilder::from_base64(&vapid.private_key, base64::URL_SAFE_NO_PAD, &sub)
            .map_err(|e| e.to_string())?;
    sig_builder.add_claim("sub", vapid.subject.clone());
    let signature = sig_builder.build().map_err(|e| e.to_string())?;

    let mut msg_builder = WebPushMessageBuilder::new(&sub);
    msg_builder.set_payload(ContentEncoding::Aes128Gcm, payload.as_bytes());
    msg_builder.set_vapid_signature(signature);

    let message = msg_builder.build().map_err(|e| e.to_string())?;
    client.send(message).await.map_err(|e: web_push::WebPushError| e.to_string())
}

pub async fn run(db: Arc<Mutex<Connection>>, vapid: Arc<VapidConfig>) {
    // Verify the push client can be constructed before entering the loop
    if let Err(e) = IsahcWebPushClient::new() {
        eprintln!("[notify] Failed to create WebPushClient: {e}");
        return;
    };

    // In-memory dedup: (todo_id, "YYYY-MM-DD-HH") — resets on server restart (acceptable)
    let mut notified: HashSet<(i64, String)> = HashSet::new();
    let mut tick = interval(Duration::from_secs(60));

    println!("[notify] Background worker started, checking every 60s");

    loop {
        tick.tick().await;

        let now = Local::now();
        let minute_key = now.format("%Y-%m-%d-%H-%M").to_string();
        println!("[notify] Tick at {}", now.format("%Y-%m-%d %H:%M"));

        // 1. Find recurring non-done todos whose cron fires right now
        // Fetch id, title, recurrency, user_id — we match on recurrency but notify with title
        let candidates: Vec<(i64, String, i64)> = {
            let conn = db.lock().unwrap();
            let mut stmt = match conn.prepare(
                "SELECT id, title, recurrency, user_id FROM todos
                 WHERE is_recurrent = 1 AND recurrency IS NOT NULL
                   AND NOT (status = 'DONE' AND last_completed_date = date('now', 'localtime'))",
            ) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[notify] DB prepare error: {e}");
                    continue;
                }
            };

            let rows = match stmt.query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,   // title
                    row.get::<_, String>(2)?,   // recurrency (for matching)
                    row.get::<_, i64>(3)?,      // user_id
                ))
            }) {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[notify] DB query error: {e}");
                    continue;
                }
            };

            rows.filter_map(|r| r.ok())
                .filter(|(id, _, recurrency, _)| {
                    !notified.contains(&(*id, minute_key.clone())) && matches_now(recurrency)
                })
                .map(|(id, title, _, user_id)| (id, title, user_id))
                .collect()
        };

        println!("[notify] {} recurring todo(s) match now", candidates.len());
        if candidates.is_empty() {
            continue;
        }

        // 2. For each due todo, send push to all of the owner's subscriptions
        for (todo_id, title, user_id) in &candidates {
            let subs: Vec<(String, String, String)> = {
                let conn = db.lock().unwrap();
                let mut stmt = match conn.prepare(
                    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?1",
                ) {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                match stmt.query_map(rusqlite::params![user_id], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                }) {
                    Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
                    Err(_) => continue,
                }
            };

            println!("[notify] Todo {todo_id} ({title:?}) matched — {} subscription(s) for user {user_id}", subs.len());
            if subs.is_empty() {
                println!("[notify] No push subscriptions for user {user_id}, skipping");
                continue;
            }

            let payload = serde_json::json!({
                "title": "Recurring task due",
                "body": title,
                "tag": format!("todo-{todo_id}"),
            })
            .to_string();

            for (endpoint, p256dh, auth) in subs {
                let short = &endpoint[endpoint.len().saturating_sub(24)..];
                match send_push(&vapid, endpoint.clone(), p256dh, auth, &payload).await {
                    Ok(()) => println!("[notify] Push sent for todo {todo_id} → ...{short}"),
                    Err(e) => eprintln!("[notify] Push failed for todo {todo_id} → ...{short}: {e}"),
                }
            }

            notified.insert((*todo_id, minute_key.clone()));
        }
    }
}

fn matches_now(expr: &str) -> bool {
    let parts: Vec<&str> = expr.trim().split_whitespace().collect();
    if parts.len() != 5 {
        return false;
    }
    let now = Local::now();
    match_field(parts[0], now.minute())
        && match_field(parts[1], now.hour())
        && match_field(parts[2], now.day())
        && match_field(parts[3], now.month())
        && match_field(parts[4], now.weekday().num_days_from_sunday())
}

fn match_field(field: &str, value: u32) -> bool {
    if field == "*" {
        return true;
    }
    if let Some(step) = field.strip_prefix("*/") {
        return step.parse::<u32>().map(|n| n > 0 && value % n == 0).unwrap_or(false);
    }
    if field.contains(',') {
        return field
            .split(',')
            .filter_map(|p| p.parse::<u32>().ok())
            .any(|v| v == value);
    }
    if let Some((start, end)) = field.split_once('-') {
        let s = start.parse::<u32>().unwrap_or(0);
        let e = end.parse::<u32>().unwrap_or(0);
        return value >= s && value <= e;
    }
    field.parse::<u32>().map(|v| v == value).unwrap_or(false)
}
