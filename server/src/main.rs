mod auth;
mod config;
mod db;
mod error;
mod models;
mod reminders;
mod routes;

use anyhow::Context;
use config::Config;
use db::Db;
use routes::AppState;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "agapenotes_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Arc::new(Config::from_env()?);
    let db = Db::open(&config.db_path).await?;
    let state = AppState {
        config: config.clone(),
        db,
        http: reqwest::Client::new(),
    };

    tokio::spawn(reminders::run_due_reminder_loop(state.clone()));

    let app = routes::router(state)
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind(config.bind_addr())
        .await
        .with_context(|| format!("failed to bind {}", config.bind_addr()))?;

    tracing::info!(
        addr = %config.bind_addr(),
        db_path = %config.db_path,
        static_dir = %config.static_dir,
        "starting AgapeNotes server"
    );

    axum::serve(listener, app).await?;
    Ok(())
}
