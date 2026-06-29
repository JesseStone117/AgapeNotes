use crate::{
    error::AppError,
    models::{AdminSqlResponse, GoogleIdentity, User, VaultRecord},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use chrono::{SecondsFormat, Utc};
use serde_json::json;
use std::{path::Path, time::Duration};
use turso::{Builder, Row, Value};
use uuid::Uuid;

#[derive(Clone)]
pub struct Db {
    database: turso::Database,
}

impl Db {
    pub async fn open(path: &str) -> Result<Self, AppError> {
        if path != ":memory:" {
            if let Some(parent) = Path::new(path).parent() {
                if !parent.as_os_str().is_empty() {
                    std::fs::create_dir_all(parent)?;
                }
            }
        }

        let database = Builder::new_local(path).build().await?;
        let db = Self { database };
        db.initialize().await?;
        Ok(db)
    }

    async fn initialize(&self) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.pragma_update("journal_mode", "'mvcc'").await?;
        conn.pragma_update("foreign_keys", "ON").await?;
        conn.execute_batch(SCHEMA).await?;
        Ok(())
    }

    pub async fn upsert_google_user(&self, identity: &GoogleIdentity) -> Result<User, AppError> {
        let conn = self.database.connect()?;
        let now = now_string();

        if let Some(existing) = self.find_user_by_google_sub(&identity.sub).await? {
            conn.execute(
                "UPDATE users
                 SET email = ?1, email_verified = ?2, display_name = ?3, picture_url = ?4, updated_at = ?5
                 WHERE id = ?6",
                (
                    identity.email.clone(),
                    identity.email_verified,
                    identity.display_name.clone(),
                    identity.picture_url.clone(),
                    now,
                    existing.id.clone(),
                ),
            )
            .await?;

            return self
                .find_user_by_google_sub(&identity.sub)
                .await?
                .ok_or_else(|| AppError::BadRequest("user disappeared after update".to_string()));
        }

        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO users
             (id, google_sub, email, email_verified, display_name, picture_url, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                id,
                identity.sub.clone(),
                identity.email.clone(),
                identity.email_verified,
                identity.display_name.clone(),
                identity.picture_url.clone(),
                now.clone(),
                now,
            ),
        )
        .await?;

        self.find_user_by_google_sub(&identity.sub)
            .await?
            .ok_or_else(|| AppError::BadRequest("user insert failed".to_string()))
    }

    pub async fn find_user_by_google_sub(
        &self,
        google_sub: &str,
    ) -> Result<Option<User>, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query(
                "SELECT id, google_sub, email, email_verified, display_name, picture_url, created_at, updated_at
                 FROM users
                 WHERE google_sub = ?1",
                (google_sub,),
            )
            .await?;

        match rows.next().await? {
            Some(row) => Ok(Some(user_from_row(&row)?)),
            None => Ok(None),
        }
    }

    pub async fn create_session(
        &self,
        token_hash: &str,
        user_id: &str,
        user_agent: Option<String>,
        expires_at: &str,
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, user_agent, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                token_hash.to_string(),
                user_id.to_string(),
                user_agent,
                now_string(),
                expires_at.to_string(),
            ),
        )
        .await?;
        Ok(())
    }

    pub async fn delete_session(&self, token_hash: &str) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.execute("DELETE FROM sessions WHERE token_hash = ?1", (token_hash,))
            .await?;
        Ok(())
    }

    pub async fn user_for_session(&self, token_hash: &str) -> Result<Option<User>, AppError> {
        let conn = self.database.connect()?;
        let now = now_string();

        conn.execute(
            "DELETE FROM sessions WHERE expires_at <= ?1",
            (now.clone(),),
        )
        .await?;

        let mut rows = conn
            .query(
                "SELECT u.id, u.google_sub, u.email, u.email_verified, u.display_name, u.picture_url, u.created_at, u.updated_at
                 FROM sessions s
                 JOIN users u ON u.id = s.user_id
                 WHERE s.token_hash = ?1 AND s.expires_at > ?2",
                (token_hash.to_string(), now),
            )
            .await?;

        match rows.next().await? {
            Some(row) => Ok(Some(user_from_row(&row)?)),
            None => Ok(None),
        }
    }

    pub async fn get_vault(&self, user_id: &str) -> Result<Option<VaultRecord>, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query(
                "SELECT revision, crypto_json, ciphertext, created_at, updated_at
                 FROM vaults
                 WHERE user_id = ?1",
                (user_id,),
            )
            .await?;

        match rows.next().await? {
            Some(row) => Ok(Some(vault_from_row(&row)?)),
            None => Ok(None),
        }
    }

    pub async fn current_vault_revision(&self, user_id: &str) -> Result<Option<i64>, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query("SELECT revision FROM vaults WHERE user_id = ?1", (user_id,))
            .await?;

        match rows.next().await? {
            Some(row) => Ok(Some(row.get::<i64>(0)?)),
            None => Ok(None),
        }
    }

    pub async fn put_vault(
        &self,
        user_id: &str,
        expected_revision: Option<i64>,
        crypto_json: &str,
        ciphertext: &str,
    ) -> Result<VaultRecord, AppError> {
        let conn = self.database.connect()?;
        let now = now_string();

        let changed = match expected_revision {
            Some(revision) => {
                conn.execute(
                    "UPDATE vaults
                     SET revision = revision + 1, crypto_json = ?1, ciphertext = ?2, updated_at = ?3
                     WHERE user_id = ?4 AND revision = ?5",
                    (
                        crypto_json.to_string(),
                        ciphertext.to_string(),
                        now,
                        user_id.to_string(),
                        revision,
                    ),
                )
                .await?
            }
            None => {
                conn.execute(
                    "INSERT OR IGNORE INTO vaults
                     (user_id, revision, crypto_json, ciphertext, created_at, updated_at)
                     VALUES (?1, 1, ?2, ?3, ?4, ?5)",
                    (
                        user_id.to_string(),
                        crypto_json.to_string(),
                        ciphertext.to_string(),
                        now.clone(),
                        now,
                    ),
                )
                .await?
            }
        };

        if changed == 0 {
            return Err(AppError::Conflict {
                current_revision: self.current_vault_revision(user_id).await?,
            });
        }

        self.get_vault(user_id)
            .await?
            .ok_or_else(|| AppError::BadRequest("vault write failed".to_string()))
    }

    pub async fn execute_admin_sql(
        &self,
        sql: &str,
        max_rows: usize,
    ) -> Result<AdminSqlResponse, AppError> {
        let conn = self.database.connect()?;
        conn.busy_timeout(Duration::from_secs(5))?;
        let mut stmt = conn.prepare(sql).await?;
        let columns = stmt.column_names();

        if columns.is_empty() {
            let rows_affected = stmt.execute(()).await?;
            return Ok(AdminSqlResponse {
                columns,
                rows: Vec::new(),
                rows_affected: Some(rows_affected),
                row_count: rows_affected as usize,
                truncated: false,
            });
        }

        let column_count = columns.len();
        let mut rows = stmt.query(()).await?;
        let mut collected = Vec::new();
        let mut truncated = false;

        while let Some(row) = rows.next().await? {
            if collected.len() >= max_rows {
                truncated = true;
                break;
            }

            let mut values = Vec::with_capacity(column_count);
            for index in 0..column_count {
                values.push(sql_value_to_json(row.get_value(index)?));
            }
            collected.push(values);
        }

        Ok(AdminSqlResponse {
            columns,
            row_count: collected.len(),
            rows: collected,
            rows_affected: None,
            truncated,
        })
    }
}

fn now_string() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn user_from_row(row: &Row) -> Result<User, AppError> {
    Ok(User {
        id: row.get::<String>(0)?,
        google_sub: row.get::<String>(1)?,
        email: row.get::<String>(2)?,
        email_verified: row.get::<i64>(3)? != 0,
        display_name: optional_string(row, 4)?,
        picture_url: optional_string(row, 5)?,
        created_at: row.get::<String>(6)?,
        updated_at: row.get::<String>(7)?,
    })
}

fn vault_from_row(row: &Row) -> Result<VaultRecord, AppError> {
    let crypto_json = row.get::<String>(1)?;
    Ok(VaultRecord {
        revision: row.get::<i64>(0)?,
        crypto: serde_json::from_str(&crypto_json)?,
        ciphertext: row.get::<String>(2)?,
        created_at: row.get::<String>(3)?,
        updated_at: row.get::<String>(4)?,
    })
}

fn optional_string(row: &Row, index: usize) -> Result<Option<String>, AppError> {
    match row.get_value(index)? {
        Value::Null => Ok(None),
        Value::Text(value) => Ok(Some(value)),
        value => Err(AppError::BadRequest(format!(
            "expected text or null at column {index}, got {value:?}"
        ))),
    }
}

fn sql_value_to_json(value: Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Integer(value) => json!(value),
        Value::Real(value) => json!(value),
        Value::Text(value) => json!(value),
        Value::Blob(value) => json!({
            "type": "blob",
            "base64": STANDARD.encode(value)
        }),
    }
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    display_name TEXT,
    picture_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS vaults (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 0,
    crypto_json TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"#;
