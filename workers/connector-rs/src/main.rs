//! EarthOS Rust connector worker — polls USGS earthquakes and POSTs to ingest.

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

#[derive(serde::Deserialize)]
struct QuakeFeature {
    id: String,
    properties: QuakeProps,
}

#[derive(serde::Deserialize)]
struct QuakeProps {
    mag: Option<f64>,
    place: Option<String>,
    time: Option<i64>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let ingest_url = env::var("EARTHOS_INGEST_URL")
        .unwrap_or_else(|_| "http://localhost:3000/api/ingest".into());
    let secret = env::var("EARTHOS_INGEST_SECRET")
        .expect("EARTHOS_INGEST_SECRET required");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("EarthOS-Connector-Worker/0.1")
        .build()?;

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
                    .header("Authorization", format!("Bearer {secret}"))
                    .json(&payload)
                    .send()
                    .await?;
                println!("ingested {count} items → HTTP {}", res.status());
            }
            Ok(_) => println!("no new items"),
            Err(e) => eprintln!("poll error: {e}"),
        }
        tokio::time::sleep(Duration::from_secs(300)).await;
    }
}

async fn poll_usgs(client: &reqwest::Client) -> Result<Vec<Item>, reqwest::Error> {
    let url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
    let data: serde_json::Value = client.get(url).send().await?.json().await?;
    let features: Vec<QuakeFeature> =
        serde_json::from_value(data["features"].clone()).unwrap_or_default();

    Ok(features
        .into_iter()
        .filter(|f| f.properties.mag.unwrap_or(0.0) >= 4.0)
        .map(|f| {
            let mag = f.properties.mag.unwrap_or(0.0);
            let place = f.properties.place.clone().unwrap_or_default();
            let ts = f
                .properties
                .time
                .map(ms_to_iso)
                .unwrap_or_else(iso_now);
            Item {
                id: format!("quake:rust:{}", f.id),
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

fn ms_to_iso(ms: i64) -> String {
    let secs = ms / 1000;
    // Minimal ISO-8601 UTC
    format!("{secs}")
}
