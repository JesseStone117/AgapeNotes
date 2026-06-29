use anyhow::{Context, Result};
use std::{env, net::SocketAddr};

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub db_path: String,
    pub static_dir: String,
    pub public_base_url: String,
    pub app_base_url: String,
    pub cookie_secure: bool,
    pub session_ttl_days: i64,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = env::var("PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(10000);
        let public_base_url = trim_trailing_slash(
            env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| format!("http://127.0.0.1:{port}")),
        );
        let app_base_url = trim_trailing_slash(
            env::var("APP_BASE_URL").unwrap_or_else(|_| public_base_url.clone()),
        );
        let cookie_secure = env::var("COOKIE_SECURE")
            .ok()
            .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or_else(|| public_base_url.starts_with("https://"));
        let session_ttl_days = env::var("SESSION_TTL_DAYS")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(30);

        Ok(Self {
            port,
            db_path: env::var("AGAPE_DB_PATH").unwrap_or_else(|_| "data/agapenotes.db".to_string()),
            static_dir: env::var("STATIC_DIR").unwrap_or_else(|_| "dist".to_string()),
            public_base_url,
            app_base_url,
            cookie_secure,
            session_ttl_days,
            google_client_id: optional_env("GOOGLE_CLIENT_ID"),
            google_client_secret: optional_env("GOOGLE_CLIENT_SECRET"),
        })
    }

    pub fn bind_addr(&self) -> SocketAddr {
        ([0, 0, 0, 0], self.port).into()
    }

    pub fn google_redirect_uri(&self) -> String {
        format!("{}/api/auth/google/callback", self.public_base_url)
    }

    pub fn require_google_config(&self) -> Result<(&str, &str)> {
        let client_id = self
            .google_client_id
            .as_deref()
            .context("GOOGLE_CLIENT_ID is not configured")?;
        let client_secret = self
            .google_client_secret
            .as_deref()
            .context("GOOGLE_CLIENT_SECRET is not configured")?;
        Ok((client_id, client_secret))
    }
}

fn optional_env(key: &str) -> Option<String> {
    env::var(key).ok().and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn trim_trailing_slash(value: String) -> String {
    value.trim_end_matches('/').to_string()
}
