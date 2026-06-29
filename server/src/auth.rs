use crate::{
    config::Config,
    error::AppError,
    models::{GoogleIdentity, User},
    routes::AppState,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, SecondsFormat, Utc};
use jsonwebtoken::{
    decode, decode_header,
    jwk::JwkSet,
    Algorithm, DecodingKey, Validation,
};
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use time::Duration as CookieDuration;

pub const SESSION_COOKIE: &str = "agapenotes_session";
pub const OAUTH_STATE_COOKIE: &str = "agapenotes_oauth_state";

#[derive(Debug, Deserialize)]
pub struct GoogleCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    id_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleClaims {
    sub: String,
    email: String,
    email_verified: bool,
    name: Option<String>,
    picture: Option<String>,
}

pub fn random_token(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn hash_session_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn oauth_state_cookie(config: &Config, state: String) -> Cookie<'static> {
    cookie(config, OAUTH_STATE_COOKIE, state, CookieDuration::minutes(10))
}

pub fn session_cookie(config: &Config, token: String) -> Cookie<'static> {
    let max_age = CookieDuration::days(config.session_ttl_days);
    cookie(config, SESSION_COOKIE, token, max_age)
}

pub fn expired_cookie(config: &Config, name: &'static str) -> Cookie<'static> {
    cookie(config, name, String::new(), CookieDuration::seconds(0))
}

fn cookie(
    config: &Config,
    name: &'static str,
    value: String,
    max_age: CookieDuration,
) -> Cookie<'static> {
    let mut builder = Cookie::build((name, value))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(max_age);

    if config.cookie_secure {
        builder = builder.secure(true);
    }

    builder.build()
}

pub async fn user_from_cookie(state: &AppState, jar: &CookieJar) -> Result<User, AppError> {
    let token = jar
        .get(SESSION_COOKIE)
        .map(|cookie| cookie.value().to_string())
        .ok_or(AppError::Unauthorized)?;
    let token_hash = hash_session_token(&token);
    state
        .db
        .user_for_session(&token_hash)
        .await?
        .ok_or(AppError::Unauthorized)
}

pub async fn exchange_google_code(
    state: &AppState,
    code: &str,
) -> Result<GoogleIdentity, AppError> {
    let (client_id, client_secret) = state
        .config
        .require_google_config()
        .map_err(AppError::from)?;
    let redirect_uri = state.config.google_redirect_uri();
    let params = [
        ("code", code),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("redirect_uri", redirect_uri.as_str()),
        ("grant_type", "authorization_code"),
    ];

    let response = state
        .http
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::OAuth(format!(
            "Google token exchange failed with {status}: {body}"
        )));
    }

    let token = response.json::<GoogleTokenResponse>().await?;
    verify_google_id_token(state, &token.id_token).await
}

async fn verify_google_id_token(
    state: &AppState,
    id_token: &str,
) -> Result<GoogleIdentity, AppError> {
    let client_id = state
        .config
        .google_client_id
        .as_deref()
        .ok_or_else(|| AppError::Config("GOOGLE_CLIENT_ID is not configured".to_string()))?;
    let header = decode_header(id_token)?;
    let kid = header
        .kid
        .ok_or_else(|| AppError::OAuth("Google ID token did not include a key id".to_string()))?;

    let jwks = state
        .http
        .get("https://www.googleapis.com/oauth2/v3/certs")
        .send()
        .await?
        .error_for_status()?
        .json::<JwkSet>()
        .await?;
    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| AppError::OAuth("Google signing key was not found".to_string()))?;
    let decoding_key = DecodingKey::from_jwk(jwk)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&["https://accounts.google.com", "accounts.google.com"]);

    let data = decode::<GoogleClaims>(id_token, &decoding_key, &validation)?;
    if !data.claims.email_verified {
        return Err(AppError::OAuth(
            "Google account email is not verified".to_string(),
        ));
    }

    Ok(GoogleIdentity {
        sub: data.claims.sub,
        email: data.claims.email,
        email_verified: data.claims.email_verified,
        display_name: data.claims.name,
        picture_url: data.claims.picture,
    })
}

pub fn session_expires_at(config: &Config) -> String {
    (Utc::now() + Duration::days(config.session_ttl_days))
        .to_rfc3339_opts(SecondsFormat::Millis, true)
}
