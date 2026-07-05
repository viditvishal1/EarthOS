//! Argus live-data worker — World Monitor-style background poller.
//! Runs as an always-on process (Railway/Fly/VM). Hits /api/cron/live on an
//! interval to seed Redis via the Next.js app, and polls USGS for ingest.

use serde::Serialize;
use std::env;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
struct IngestPayload {
    #[serde(rename = "connectorId")]
    connector_id: String,
    items: Vec<Item>,
}

#[derive(Serialize)]
struct Item {
    id: String,
    module: String,
    #[serde(rename = "connectorId")]
    connector_id: String,
    title: String,
    summary: Option<String>,
    source: String,
    timestamp: String,
    tags: Vec<String>,
    entities: Vec<Entity>,
    #[serde(rename = "contentPolicy")]
    content_policy: String,
}

#[derive(Serialize)]
struct Entity {
    name: String,
    #[serde(rename = "type")]
    entity_type: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app_url = env::var("ARGUS_APP_URL")
        .or_else(|_| env::var("EARTHOS_APP_URL"))
        .unwrap_or_else(|_| "http://localhost:3000".into());
    let cron_secret = env::var("CRON_SECRET")
        .or_else(|_| env::var("ARGUS_ADMIN_SECRET"))
        .or_else(|_| env::var("EARTHOS_ADMIN_SECRET"))
        .unwrap_or_default();
    let ingest_url = env::var("ARGUS_INGEST_URL")
        .or_else(|_| env::var("EARTHOS_INGEST_URL"))
        .unwrap_or_else(|_| format!("{app_url}/api/ingest"));
    let ingest_secret = env::var("ARGUS_INGEST_SECRET")
        .or_else(|_| env::var("EARTHOS_INGEST_SECRET"))
        .unwrap_or_default();

    let live_interval_secs: u64 = env::var("LIVE_SEED_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(90);
    let usgs_interval_secs: u64 = env::var("USGS_POLL_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(300);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("Argus-Live-Worker/1.0")
        .build()?;

    println!(
        "argus live worker started — app={app_url} live={live_interval_secs}s usgs={usgs_interval_secs}s"
    );

    let client_live = client.clone();
    let app_live = app_url.clone();
    let secret_live = cron_secret.clone();
    tokio::spawn(async move {
        let mut consecutive_failures: u32 = 0;
        const MAX_BACKOFF_SECS: u64 = 600;

        loop {
            let sleep_secs = if consecutive_failures == 0 {
                live_interval_secs
            } else {
                (live_interval_secs * consecutive_failures as u64).min(MAX_BACKOFF_SECS)
            };

            if secret_live.is_empty() {
                eprintln!("CRON_SECRET not set — skipping live seed");
            } else {
                let url = format!("{app_live}/api/cron/live");
                match client_live
                    .get(&url)
                    .header("Authorization", format!("Bearer {secret_live}"))
                    .send()
                    .await
                {
                    Ok(res) => {
                        let status = res.status();
                        let body = res.text().await.unwrap_or_default();
                        // Log status + truncated body — never log Authorization header
                        let preview: String = body.chars().take(200).collect();
                        if status.is_success() {
                            consecutive_failures = 0;
                            println!("live seed → HTTP {status} {preview}");
                        } else if status.as_u16() == 409 {
                            consecutive_failures = 0;
                            println!("live seed → HTTP 409 already running (ok)");
                        } else {
                            consecutive_failures = consecutive_failures.saturating_add(1);
                            eprintln!(
                                "live seed → HTTP {status} (failures={consecutive_failures}) {preview}"
                            );
                        }
                    }
                    Err(e) => {
                        consecutive_failures = consecutive_failures.saturating_add(1);
                        eprintln!("live seed error (failures={consecutive_failures}): {e}");
                    }
                }
            }

            tokio::time::sleep(Duration::from_secs(sleep_secs)).await;
        }
    });

    if !ingest_secret.is_empty() {
        loop {
            match poll_usgs(&client).await {
                Ok(items) if !items.is_empty() => {
                    let count = items.len();
                    let payload = IngestPayload {
                        connector_id: "rust_usgs_earthquakes".into(),
                        items,
                    };
                    let res = client
                        .post(&ingest_url)
                        .header("Authorization", format!("Bearer {ingest_secret}"))
                        .json(&payload)
                        .send()
                        .await?;
                    println!("USGS ingest {count} items → HTTP {}", res.status());
                }
                Ok(_) => println!("USGS: no new items"),
                Err(e) => eprintln!("USGS poll error: {e}"),
            }
            tokio::time::sleep(Duration::from_secs(usgs_interval_secs)).await;
        }
    } else {
        // Keep process alive for live seed task only
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await;
        }
    }
}

async fn poll_usgs(client: &reqwest::Client) -> Result<Vec<Item>, reqwest::Error> {
    let url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
    let data: serde_json::Value = client.get(url).send().await?.json().await?;
    let features: Vec<serde_json::Value> = data["features"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(features
        .into_iter()
        .filter(|f| f["properties"]["mag"].as_f64().unwrap_or(0.0) >= 4.0)
        .map(|f| {
            let id = f["id"].as_str().unwrap_or("unknown").to_string();
            let mag = f["properties"]["mag"].as_f64().unwrap_or(0.0);
            let place = f["properties"]["place"].as_str().unwrap_or("").to_string();
            let ts = f["properties"]["time"]
                .as_i64()
                .map(|ms| format!("{}", ms / 1000))
                .unwrap_or_else(iso_now);
            Item {
                id: format!("quake:rust:{id}"),
                module: "earth".into(),
                connector_id: "rust_usgs_earthquakes".into(),
                title: format!("M{mag:.1} — {place}"),
                summary: Some(format!("Magnitude {mag:.1} earthquake near {place}")),
                source: "USGS (Rust worker)".into(),
                timestamp: ts,
                tags: vec!["earthquake".into()],
                entities: vec![Entity {
                    name: place,
                    entity_type: "location".into(),
                }],
                content_policy: "excerpt_only".into(),
            }
        })
        .collect())
}

fn iso_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("{secs}")
}
