use crate::{
    auth::{
        GoogleCallbackQuery, OAUTH_STATE_COOKIE, SESSION_COOKIE, exchange_google_code,
        expired_cookie, hash_session_token, oauth_state_cookie, random_token, session_cookie,
        session_expires_at, user_from_cookie,
    },
    config::Config,
    db::Db,
    error::AppError,
    models::{
        AdminSqlRequest, AdminSqlResponse, DeletePushSubscriptionRequest, PushConfigResponse,
        PushSubscriptionRequest, PutVaultRequest, ReminderStatusResponse,
        SaveMeetingRemindersRequest, User, VaultResponse, VaultSummary,
    },
};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Redirect},
    routing::{delete, get, post},
};
use axum_extra::extract::cookie::CookieJar;
use serde::Serialize;
use std::{path::PathBuf, sync::Arc};
use tower_http::services::{ServeDir, ServeFile};
use url::Url;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: Db,
    pub http: reqwest::Client,
}

pub fn router(state: AppState) -> Router {
    let static_dir = PathBuf::from(&state.config.static_dir);
    let index_path = static_dir.join("index.html");
    let static_files = ServeDir::new(static_dir).fallback(ServeFile::new(index_path));

    Router::new()
        .route("/health", get(health))
        .route("/api/health", get(health))
        .route("/api/auth/google/start", get(start_google_auth))
        .route("/api/auth/google/callback", get(google_callback))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
        .route("/api/vault", get(get_vault).put(put_vault))
        .route("/api/push/config", get(push_config))
        .route(
            "/api/push/subscriptions",
            post(save_push_subscription).delete(delete_push_subscription),
        )
        .route("/api/push/test", post(send_test_push))
        .route("/api/reminders/status", get(reminder_status))
        .route("/api/reminders/meeting", post(save_meeting_reminders))
        .route(
            "/api/reminders/meeting/{meeting_id}",
            delete(delete_meeting_reminders),
        )
        .route("/api/admin/sql", post(admin_sql))
        .fallback_service(static_files)
        .with_state(state)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn start_google_auth(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    let (client_id, _) = state
        .config
        .require_google_config()
        .map_err(AppError::from)?;
    let oauth_state = random_token(32);
    let mut url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|err| AppError::OAuth(err.to_string()))?;
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", &state.config.google_redirect_uri())
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile")
        .append_pair("state", &oauth_state)
        .append_pair("access_type", "online")
        .append_pair("prompt", "select_account");

    let jar = jar.add(oauth_state_cookie(&state.config, oauth_state));
    Ok((jar, Redirect::to(url.as_str())))
}

async fn google_callback(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(query): Query<GoogleCallbackQuery>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    if let Some(error) = query.error {
        return Err(AppError::OAuth(format!(
            "Google returned an error: {error}"
        )));
    }

    let expected_state = jar
        .get(OAUTH_STATE_COOKIE)
        .map(|cookie| cookie.value().to_string())
        .ok_or_else(|| AppError::BadRequest("missing OAuth state cookie".to_string()))?;
    let returned_state = query
        .state
        .ok_or_else(|| AppError::BadRequest("missing OAuth state".to_string()))?;
    if expected_state != returned_state {
        return Err(AppError::BadRequest("OAuth state mismatch".to_string()));
    }

    let code = query
        .code
        .ok_or_else(|| AppError::BadRequest("missing OAuth code".to_string()))?;
    let identity = exchange_google_code(&state, &code).await?;
    let user = state.db.upsert_google_user(&identity).await?;

    let session_token = random_token(48);
    let session_hash = hash_session_token(&session_token);
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.chars().take(512).collect::<String>());
    let expires_at = session_expires_at(&state.config);
    state
        .db
        .create_session(&session_hash, &user.id, user_agent, &expires_at)
        .await?;

    let jar = jar
        .add(session_cookie(&state.config, session_token))
        .add(expired_cookie(&state.config, OAUTH_STATE_COOKIE));
    let redirect_url = format!("{}/?auth=success", state.config.app_base_url);

    Ok((jar, Redirect::to(&redirect_url)))
}

async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        let token_hash = hash_session_token(cookie.value());
        state.db.delete_session(&token_hash).await?;
    }

    let jar = jar.add(expired_cookie(&state.config, SESSION_COOKIE));
    Ok((jar, StatusCode::NO_CONTENT))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MeResponse {
    authenticated: bool,
    user: Option<User>,
    vault: Option<VaultSummary>,
}

async fn me(State(state): State<AppState>, jar: CookieJar) -> Result<Json<MeResponse>, AppError> {
    let user = match user_from_cookie(&state, &jar).await {
        Ok(user) => user,
        Err(AppError::Unauthorized) => {
            return Ok(Json(MeResponse {
                authenticated: false,
                user: None,
                vault: None,
            }));
        }
        Err(err) => return Err(err),
    };
    let vault = state.db.get_vault(&user.id).await?;

    Ok(Json(MeResponse {
        authenticated: true,
        user: Some(user),
        vault: Some(VaultSummary::from(vault)),
    }))
}

async fn get_vault(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<VaultResponse>, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    let vault = state.db.get_vault(&user.id).await?;
    Ok(Json(VaultResponse::from(vault)))
}

async fn put_vault(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<PutVaultRequest>,
) -> Result<Json<VaultResponse>, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    validate_vault_payload(&payload)?;
    let crypto_json = serde_json::to_string(&payload.crypto)?;
    let vault = state
        .db
        .put_vault(
            &user.id,
            payload.expected_revision,
            &crypto_json,
            &payload.ciphertext,
        )
        .await?;
    Ok(Json(VaultResponse::from(Some(vault))))
}

async fn push_config(State(state): State<AppState>) -> Json<PushConfigResponse> {
    Json(PushConfigResponse {
        public_key: if state.config.push_reminders_configured() {
            state.config.vapid_public_key.clone()
        } else {
            None
        },
    })
}

async fn save_push_subscription(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(payload): Json<PushSubscriptionRequest>,
) -> Result<StatusCode, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    validate_push_subscription(&payload)?;
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.chars().take(512).collect::<String>());
    state
        .db
        .upsert_push_subscription(&user.id, &payload, user_agent)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_push_subscription(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<DeletePushSubscriptionRequest>,
) -> Result<StatusCode, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    if payload.endpoint.trim().is_empty() {
        return Err(AppError::BadRequest(
            "subscription endpoint is required".to_string(),
        ));
    }
    state
        .db
        .delete_push_subscription(&user.id, &payload.endpoint)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn send_test_push(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<crate::models::PushTestResponse>, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    let response = crate::reminders::send_test_push(&state, &user.id).await?;
    Ok(Json(response))
}

async fn reminder_status(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<ReminderStatusResponse>, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    let subscription_count = state.db.push_subscription_count_for_user(&user.id).await?;
    let reminders = state.db.reminder_statuses_for_user(&user.id, 25).await?;

    Ok(Json(ReminderStatusResponse {
        subscription_count,
        reminders,
    }))
}

async fn save_meeting_reminders(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<SaveMeetingRemindersRequest>,
) -> Result<StatusCode, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    validate_meeting_reminders(&payload)?;
    state
        .db
        .replace_meeting_reminders(&user.id, &payload.meeting_id, &payload.reminders)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_meeting_reminders(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(meeting_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let user = user_from_cookie(&state, &jar).await?;
    if meeting_id.trim().is_empty() {
        return Err(AppError::BadRequest("meeting id is required".to_string()));
    }
    state
        .db
        .delete_meeting_reminders(&user.id, &meeting_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn admin_sql(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdminSqlRequest>,
) -> Result<Json<AdminSqlResponse>, AppError> {
    require_admin_sql_token(&state, &headers)?;
    validate_admin_sql(&payload.sql)?;

    let max_rows = payload.max_rows.unwrap_or(250).clamp(1, 2000);
    tracing::warn!(
        max_rows,
        sql_len = payload.sql.len(),
        "admin SQL endpoint invoked"
    );

    let result = state.db.execute_admin_sql(&payload.sql, max_rows).await?;
    Ok(Json(result))
}

fn validate_vault_payload(payload: &PutVaultRequest) -> Result<(), AppError> {
    if !payload.crypto.is_object() {
        return Err(AppError::BadRequest(
            "vault crypto metadata must be an object".to_string(),
        ));
    }

    if payload.ciphertext.is_empty() {
        return Err(AppError::BadRequest(
            "vault ciphertext cannot be empty".to_string(),
        ));
    }

    const MAX_CIPHERTEXT_BYTES: usize = 25 * 1024 * 1024;
    if payload.ciphertext.len() > MAX_CIPHERTEXT_BYTES {
        return Err(AppError::BadRequest(
            "vault ciphertext is too large".to_string(),
        ));
    }

    Ok(())
}

fn validate_push_subscription(payload: &PushSubscriptionRequest) -> Result<(), AppError> {
    if payload.endpoint.trim().is_empty() {
        return Err(AppError::BadRequest(
            "subscription endpoint is required".to_string(),
        ));
    }
    if payload.keys.p256dh.trim().is_empty() || payload.keys.auth.trim().is_empty() {
        return Err(AppError::BadRequest(
            "subscription keys are required".to_string(),
        ));
    }
    if payload.endpoint.len() > 4096 {
        return Err(AppError::BadRequest(
            "subscription endpoint is too large".to_string(),
        ));
    }
    Ok(())
}

fn validate_meeting_reminders(payload: &SaveMeetingRemindersRequest) -> Result<(), AppError> {
    if payload.meeting_id.trim().is_empty() {
        return Err(AppError::BadRequest("meeting id is required".to_string()));
    }
    if payload.reminders.len() > 64 {
        return Err(AppError::BadRequest(
            "too many reminders for one meeting".to_string(),
        ));
    }
    for reminder in &payload.reminders {
        if reminder.remind_at.trim().is_empty()
            || reminder.meeting_date.trim().is_empty()
            || reminder.meeting_time.trim().is_empty()
        {
            return Err(AppError::BadRequest(
                "reminder time and meeting time are required".to_string(),
            ));
        }
    }
    Ok(())
}

fn require_admin_sql_token(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let accepted_tokens = [
        state.config.admin_sql_token.as_deref(),
        state.config.codex_admin_sql_token.as_deref(),
    ];
    if accepted_tokens.iter().all(Option::is_none) {
        return Err(AppError::NotFound);
    }

    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or(AppError::Unauthorized)?;
    let token = authorization
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    if accepted_tokens
        .iter()
        .flatten()
        .any(|expected| constant_time_eq(token.as_bytes(), expected.as_bytes()))
    {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    let mut diff = 0u8;
    for (left, right) in left.iter().zip(right.iter()) {
        diff |= left ^ right;
    }

    diff == 0
}

fn validate_admin_sql(sql: &str) -> Result<(), AppError> {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("SQL cannot be empty".to_string()));
    }

    const MAX_SQL_BYTES: usize = 100 * 1024;
    if trimmed.len() > MAX_SQL_BYTES {
        return Err(AppError::BadRequest("SQL is too large".to_string()));
    }

    if has_multiple_statements(trimmed) {
        return Err(AppError::BadRequest(
            "Only one SQL statement is allowed per request".to_string(),
        ));
    }

    Ok(())
}

fn has_multiple_statements(sql: &str) -> bool {
    #[derive(Copy, Clone)]
    enum Mode {
        Normal,
        SingleQuote,
        DoubleQuote,
        LineComment,
        BlockComment,
    }

    let bytes = sql.as_bytes();
    let mut index = 0;
    let mut mode = Mode::Normal;
    let mut ended = false;

    while index < bytes.len() {
        let current = bytes[index];
        let next = bytes.get(index + 1).copied();

        match mode {
            Mode::Normal => {
                if ended && !current.is_ascii_whitespace() {
                    return true;
                }

                match (current, next) {
                    (b'\'', _) => mode = Mode::SingleQuote,
                    (b'"', _) => mode = Mode::DoubleQuote,
                    (b'-', Some(b'-')) => {
                        mode = Mode::LineComment;
                        index += 1;
                    }
                    (b'/', Some(b'*')) => {
                        mode = Mode::BlockComment;
                        index += 1;
                    }
                    (b';', _) => ended = true,
                    _ => {}
                }
            }
            Mode::SingleQuote => {
                if current == b'\'' {
                    if next == Some(b'\'') {
                        index += 1;
                    } else {
                        mode = Mode::Normal;
                    }
                }
            }
            Mode::DoubleQuote => {
                if current == b'"' {
                    if next == Some(b'"') {
                        index += 1;
                    } else {
                        mode = Mode::Normal;
                    }
                }
            }
            Mode::LineComment => {
                if current == b'\n' {
                    mode = Mode::Normal;
                }
            }
            Mode::BlockComment => {
                if current == b'*' && next == Some(b'/') {
                    mode = Mode::Normal;
                    index += 1;
                }
            }
        }

        index += 1;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::has_multiple_statements;

    #[test]
    fn detects_multiple_admin_sql_statements() {
        assert!(!has_multiple_statements("SELECT 1"));
        assert!(!has_multiple_statements("SELECT ';' AS value;"));
        assert!(!has_multiple_statements("SELECT 'that''s fine';"));
        assert!(has_multiple_statements("SELECT 1; SELECT 2"));
    }
}
