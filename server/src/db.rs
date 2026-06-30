use crate::{
    error::AppError,
    models::{
        AdminSqlResponse, DueReminder, GoogleIdentity, MeetingReminderInput,
        PushSubscriptionRecord, PushSubscriptionRequest, ReminderStatusItem, User, VaultRecord,
    },
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

    pub async fn upsert_push_subscription(
        &self,
        user_id: &str,
        subscription: &PushSubscriptionRequest,
        user_agent: Option<String>,
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        let now = now_string();
        conn.execute(
            "INSERT INTO push_subscriptions
             (endpoint, user_id, p256dh, auth, user_agent, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(endpoint) DO UPDATE SET
                user_id = excluded.user_id,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                user_agent = excluded.user_agent,
                updated_at = excluded.updated_at",
            (
                subscription.endpoint.clone(),
                user_id.to_string(),
                subscription.keys.p256dh.clone(),
                subscription.keys.auth.clone(),
                user_agent,
                now.clone(),
                now,
            ),
        )
        .await?;
        Ok(())
    }

    pub async fn delete_push_subscription(
        &self,
        user_id: &str,
        endpoint: &str,
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.execute(
            "DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2",
            (user_id.to_string(), endpoint.to_string()),
        )
        .await?;
        Ok(())
    }

    pub async fn delete_push_subscription_by_endpoint(
        &self,
        endpoint: &str,
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = ?1",
            (endpoint.to_string(),),
        )
        .await?;
        Ok(())
    }

    pub async fn push_subscriptions_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<PushSubscriptionRecord>, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query(
                "SELECT endpoint FROM push_subscriptions WHERE user_id = ?1",
                (user_id.to_string(),),
            )
            .await?;

        let mut subscriptions = Vec::new();
        while let Some(row) = rows.next().await? {
            subscriptions.push(PushSubscriptionRecord {
                endpoint: row.get::<String>(0)?,
            });
        }
        Ok(subscriptions)
    }

    pub async fn push_subscription_count_for_user(&self, user_id: &str) -> Result<usize, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query(
                "SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?1",
                (user_id.to_string(),),
            )
            .await?;

        match rows.next().await? {
            Some(row) => Ok(row.get::<i64>(0)? as usize),
            None => Ok(0),
        }
    }

    pub async fn replace_meeting_reminders(
        &self,
        user_id: &str,
        meeting_id: &str,
        reminders: &[MeetingReminderInput],
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        let now = now_string();
        conn.execute("BEGIN IMMEDIATE", ()).await?;
        let result = async {
            conn.execute(
                "DELETE FROM reminders
                 WHERE user_id = ?1 AND meeting_id = ?2 AND status IN ('pending', 'failed')",
                (user_id.to_string(), meeting_id.to_string()),
            )
            .await?;

            for reminder in reminders {
                conn.execute(
                    "INSERT INTO reminders
                     (id, user_id, meeting_id, remind_at, meeting_date, meeting_time, offset_minutes, status, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9)",
                    (
                        Uuid::new_v4().to_string(),
                        user_id.to_string(),
                        meeting_id.to_string(),
                        reminder.remind_at.clone(),
                        reminder.meeting_date.clone(),
                        reminder.meeting_time.clone(),
                        reminder.offset_minutes,
                        now.clone(),
                        now.clone(),
                    ),
                )
                .await?;
            }
            Ok::<(), AppError>(())
        }
        .await;

        match result {
            Ok(()) => {
                conn.execute("COMMIT", ()).await?;
                Ok(())
            }
            Err(err) => {
                let _ = conn.execute("ROLLBACK", ()).await;
                Err(err)
            }
        }
    }

    pub async fn delete_meeting_reminders(
        &self,
        user_id: &str,
        meeting_id: &str,
    ) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        conn.execute(
            "DELETE FROM reminders WHERE user_id = ?1 AND meeting_id = ?2",
            (user_id.to_string(), meeting_id.to_string()),
        )
        .await?;
        Ok(())
    }

    pub async fn reminder_statuses_for_user(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<ReminderStatusItem>, AppError> {
        let conn = self.database.connect()?;
        let mut rows = conn
            .query(
                "SELECT meeting_id, remind_at, meeting_date, meeting_time, offset_minutes,
                        status, sent_at, failed_at, failure_count, updated_at
                 FROM reminders
                 WHERE user_id = ?1
                 ORDER BY remind_at DESC
                 LIMIT ?2",
                (user_id.to_string(), limit as i64),
            )
            .await?;

        let mut reminders = Vec::new();
        while let Some(row) = rows.next().await? {
            reminders.push(ReminderStatusItem {
                meeting_id: row.get::<String>(0)?,
                remind_at: row.get::<String>(1)?,
                meeting_date: row.get::<String>(2)?,
                meeting_time: row.get::<String>(3)?,
                offset_minutes: match row.get_value(4)? {
                    Value::Null => None,
                    Value::Integer(value) => Some(value),
                    value => {
                        return Err(AppError::BadRequest(format!(
                            "expected integer or null at column 4, got {value:?}"
                        )));
                    }
                },
                status: row.get::<String>(5)?,
                sent_at: optional_string(&row, 6)?,
                failed_at: optional_string(&row, 7)?,
                failure_count: row.get::<i64>(8)?,
                updated_at: row.get::<String>(9)?,
            });
        }

        Ok(reminders)
    }

    pub async fn claim_due_reminders(&self, limit: usize) -> Result<Vec<DueReminder>, AppError> {
        let conn = self.database.connect()?;
        let now = now_string();
        let retry_cutoff = time_string(Utc::now() - chrono::Duration::minutes(1));
        let stuck_cutoff = time_string(Utc::now() - chrono::Duration::minutes(10));
        let mut rows = conn
            .query(
                "SELECT id, user_id
                 FROM reminders
                 WHERE remind_at <= ?1
                   AND (
                     status = 'pending'
                     OR (status = 'failed' AND failure_count < 3 AND failed_at <= ?2)
                     OR (status = 'sending' AND updated_at <= ?3)
                   )
                 ORDER BY remind_at ASC
                 LIMIT ?4",
                (now.clone(), retry_cutoff, stuck_cutoff, limit as i64),
            )
            .await?;

        let mut reminders = Vec::new();
        while let Some(row) = rows.next().await? {
            reminders.push(DueReminder {
                id: row.get::<String>(0)?,
                user_id: row.get::<String>(1)?,
            });
        }

        for reminder in &reminders {
            conn.execute(
                "UPDATE reminders
                 SET status = 'sending', updated_at = ?1
                 WHERE id = ?2
                   AND (
                     status = 'pending'
                     OR (status = 'failed' AND failure_count < 3)
                     OR status = 'sending'
                   )",
                (now.clone(), reminder.id.clone()),
            )
            .await?;
        }

        Ok(reminders)
    }

    pub async fn mark_reminder_sent(&self, reminder_id: &str) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        let now = now_string();
        conn.execute(
            "UPDATE reminders
             SET status = 'sent', sent_at = ?1, updated_at = ?2
             WHERE id = ?3",
            (now.clone(), now, reminder_id.to_string()),
        )
        .await?;
        Ok(())
    }

    pub async fn mark_reminder_failed(&self, reminder_id: &str) -> Result<(), AppError> {
        let conn = self.database.connect()?;
        let now = now_string();
        conn.execute(
            "UPDATE reminders
             SET status = 'failed', failed_at = ?1, failure_count = failure_count + 1, updated_at = ?2
             WHERE id = ?3",
            (now.clone(), now, reminder_id.to_string()),
        )
        .await?;
        Ok(())
    }
}

fn now_string() -> String {
    time_string(Utc::now())
}

fn time_string(value: chrono::DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Millis, true)
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

CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_id TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    meeting_time TEXT NOT NULL,
    offset_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at TEXT,
    failed_at TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_meeting ON reminders(user_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, remind_at);
"#;
