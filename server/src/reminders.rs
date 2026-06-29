use crate::{
    error::AppError,
    models::{DueReminder, PushTestResponse},
    routes::AppState,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use reqwest::{StatusCode, header};
use serde::Serialize;
use tokio::time::{MissedTickBehavior, interval};
use url::Url;

#[derive(Debug, Serialize)]
struct VapidClaims<'a> {
    aud: &'a str,
    exp: usize,
    sub: &'a str,
}

pub async fn run_due_reminder_loop(state: AppState) {
    if !state.config.push_reminders_configured() {
        tracing::info!("push reminders disabled; VAPID keys are not configured");
        return;
    }

    let mut ticker = interval(std::time::Duration::from_secs(
        state.config.reminder_poll_interval_seconds.max(10),
    ));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

    loop {
        ticker.tick().await;
        if let Err(error) = process_due_reminders(&state).await {
            tracing::warn!(error = ?error, "due reminder processing failed");
        }
    }
}

async fn process_due_reminders(state: &AppState) -> Result<(), AppError> {
    let reminders = state.db.claim_due_reminders(50).await?;
    for reminder in reminders {
        if let Err(error) = process_one_reminder(state, &reminder).await {
            tracing::warn!(reminder_id = %reminder.id, error = ?error, "reminder delivery failed");
            state.db.mark_reminder_failed(&reminder.id).await?;
        }
    }
    Ok(())
}

async fn process_one_reminder(state: &AppState, reminder: &DueReminder) -> Result<(), AppError> {
    let subscriptions = state
        .db
        .push_subscriptions_for_user(&reminder.user_id)
        .await?;
    if subscriptions.is_empty() {
        state.db.mark_reminder_failed(&reminder.id).await?;
        return Ok(());
    }

    let mut sent = false;
    for subscription in subscriptions {
        match send_web_push(state, &subscription.endpoint).await {
            Ok(()) => sent = true,
            Err(PushSendError::Gone) => {
                state
                    .db
                    .delete_push_subscription_by_endpoint(&subscription.endpoint)
                    .await?;
            }
            Err(PushSendError::Other(error)) => {
                tracing::warn!(error = %error, "push service rejected reminder");
            }
        }
    }

    if sent {
        state.db.mark_reminder_sent(&reminder.id).await?;
    } else {
        state.db.mark_reminder_failed(&reminder.id).await?;
    }
    Ok(())
}

enum PushSendError {
    Gone,
    Other(String),
}

pub async fn send_test_push(state: &AppState, user_id: &str) -> Result<PushTestResponse, AppError> {
    if !state.config.push_reminders_configured() {
        return Err(AppError::Config(
            "push reminders are not configured correctly".to_string(),
        ));
    }

    let subscriptions = state.db.push_subscriptions_for_user(user_id).await?;
    let mut response = PushTestResponse {
        subscription_count: subscriptions.len(),
        sent_count: 0,
        failed_count: 0,
        stale_count: 0,
        errors: Vec::new(),
    };

    for subscription in subscriptions {
        match send_web_push(state, &subscription.endpoint).await {
            Ok(()) => response.sent_count += 1,
            Err(PushSendError::Gone) => {
                response.stale_count += 1;
                state
                    .db
                    .delete_push_subscription_by_endpoint(&subscription.endpoint)
                    .await?;
            }
            Err(PushSendError::Other(error)) => {
                response.failed_count += 1;
                response.errors.push(error);
            }
        }
    }

    response.errors.sort();
    response.errors.dedup();
    Ok(response)
}

async fn send_web_push(state: &AppState, endpoint: &str) -> Result<(), PushSendError> {
    let token =
        build_vapid_token(state, endpoint).map_err(|err| PushSendError::Other(err.to_string()))?;
    let public_key = state
        .config
        .vapid_public_key
        .as_deref()
        .ok_or_else(|| PushSendError::Other("missing VAPID public key".to_string()))?;

    let response = web_push_request(&state.http, endpoint, &token, public_key)
        .send()
        .await
        .map_err(|err| PushSendError::Other(err.to_string()))?;

    let status = response.status();
    match status {
        StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED | StatusCode::NO_CONTENT => {
            Ok(())
        }
        StatusCode::NOT_FOUND | StatusCode::GONE => Err(PushSendError::Gone),
        status => {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "response body unavailable".to_string());
            let detail = body
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .chars()
                .take(180)
                .collect::<String>();
            Err(PushSendError::Other(format!(
                "push service returned {status}: {detail}"
            )))
        }
    }
}

fn web_push_request(
    client: &reqwest::Client,
    endpoint: &str,
    token: &str,
    public_key: &str,
) -> reqwest::RequestBuilder {
    client
        .post(endpoint)
        .header("TTL", "300")
        .header("Urgency", "normal")
        .header("Authorization", format!("vapid t={token}, k={public_key}"))
        .header(header::CONTENT_LENGTH, "0")
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .body(Vec::new())
}

fn build_vapid_token(state: &AppState, endpoint: &str) -> Result<String, AppError> {
    let audience = push_audience(endpoint)?;
    let private_key = state
        .config
        .vapid_private_key_pem
        .as_deref()
        .ok_or_else(|| AppError::Config("missing VAPID private key".to_string()))?;
    let claims = VapidClaims {
        aud: &audience,
        exp: (Utc::now() + Duration::hours(12)).timestamp() as usize,
        sub: &state.config.vapid_subject,
    };
    let header = Header::new(Algorithm::ES256);
    Ok(encode(
        &header,
        &claims,
        &EncodingKey::from_ec_pem(private_key.as_bytes())?,
    )?)
}

fn push_audience(endpoint: &str) -> Result<String, AppError> {
    let url = Url::parse(endpoint)
        .map_err(|err| AppError::BadRequest(format!("invalid push endpoint: {err}")))?;
    let scheme = url.scheme();
    let host = url
        .host_str()
        .ok_or_else(|| AppError::BadRequest("push endpoint is missing host".to_string()))?;
    let audience = match url.port() {
        Some(port) => format!("{scheme}://{host}:{port}"),
        None => format!("{scheme}://{host}"),
    };
    Ok(audience)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_push_request_declares_empty_body_length() {
        let request = web_push_request(
            &reqwest::Client::new(),
            "https://fcm.googleapis.com/fcm/send/test",
            "token",
            "public-key",
        )
        .build()
        .expect("request should build");

        assert_eq!(request.headers().get(header::CONTENT_LENGTH).unwrap(), "0");
        assert_eq!(
            request.headers().get(header::CONTENT_TYPE).unwrap(),
            "application/octet-stream"
        );
    }
}
