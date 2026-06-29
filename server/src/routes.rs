use crate::{
    auth::{
        exchange_google_code, expired_cookie, hash_session_token, oauth_state_cookie, random_token,
        session_cookie, session_expires_at, user_from_cookie, GoogleCallbackQuery,
        OAUTH_STATE_COOKIE, SESSION_COOKIE,
    },
    config::Config,
    db::Db,
    error::AppError,
    models::{PutVaultRequest, User, VaultResponse, VaultSummary},
};
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect},
    routing::{get, post},
    Json, Router,
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
        return Err(AppError::OAuth(format!("Google returned an error: {error}")));
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

async fn me(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<MeResponse>, AppError> {
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
