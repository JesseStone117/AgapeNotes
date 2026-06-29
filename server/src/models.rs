use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub google_sub: String,
    pub email: String,
    pub email_verified: bool,
    pub display_name: Option<String>,
    pub picture_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct GoogleIdentity {
    pub sub: String,
    pub email: String,
    pub email_verified: bool,
    pub display_name: Option<String>,
    pub picture_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultRecord {
    pub revision: i64,
    pub crypto: serde_json::Value,
    pub ciphertext: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutVaultRequest {
    pub expected_revision: Option<i64>,
    pub crypto: serde_json::Value,
    pub ciphertext: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSqlRequest {
    pub sql: String,
    pub max_rows: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSqlResponse {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: Option<u64>,
    pub row_count: usize,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultResponse {
    pub exists: bool,
    pub revision: Option<i64>,
    pub crypto: Option<serde_json::Value>,
    pub ciphertext: Option<String>,
    pub updated_at: Option<String>,
}

impl From<Option<VaultRecord>> for VaultResponse {
    fn from(value: Option<VaultRecord>) -> Self {
        match value {
            Some(record) => Self {
                exists: true,
                revision: Some(record.revision),
                crypto: Some(record.crypto),
                ciphertext: Some(record.ciphertext),
                updated_at: Some(record.updated_at),
            },
            None => Self {
                exists: false,
                revision: None,
                crypto: None,
                ciphertext: None,
                updated_at: None,
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSummary {
    pub exists: bool,
    pub revision: Option<i64>,
    pub updated_at: Option<String>,
}

impl From<Option<VaultRecord>> for VaultSummary {
    fn from(value: Option<VaultRecord>) -> Self {
        match value {
            Some(record) => Self {
                exists: true,
                revision: Some(record.revision),
                updated_at: Some(record.updated_at),
            },
            None => Self {
                exists: false,
                revision: None,
                updated_at: None,
            },
        }
    }
}
