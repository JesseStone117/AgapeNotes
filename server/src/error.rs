use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found")]
    NotFound,
    #[error("unauthorized")]
    Unauthorized,
    #[error("vault revision conflict")]
    Conflict { current_revision: Option<i64> },
    #[error("oauth error: {0}")]
    OAuth(String),
    #[error("configuration error: {0}")]
    Config(String),
    #[error("database error: {0}")]
    Database(#[from] turso::Error),
    #[error("http client error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("jwt error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, body) = match self {
            Self::BadRequest(message) => (StatusCode::BAD_REQUEST, json!({ "error": message })),
            Self::NotFound => (StatusCode::NOT_FOUND, json!({ "error": "not found" })),
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                json!({ "error": "authentication required" }),
            ),
            Self::Conflict { current_revision } => (
                StatusCode::CONFLICT,
                json!({
                    "error": "vault revision conflict",
                    "currentRevision": current_revision
                }),
            ),
            Self::OAuth(message) => (StatusCode::BAD_GATEWAY, json!({ "error": message })),
            Self::Config(message) => (StatusCode::SERVICE_UNAVAILABLE, json!({ "error": message })),
            err => {
                tracing::error!(error = ?err, "request failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    json!({ "error": "internal server error" }),
                )
            }
        };

        (status, Json(body)).into_response()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        Self::Config(value.to_string())
    }
}
