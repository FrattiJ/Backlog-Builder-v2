use std::time::{SystemTime, UNIX_EPOCH};

const HLTB_BASE: &str = "https://howlongtobeat.com";
const HLTB_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Uses native-tls (SChannel on Windows) instead of rustls to pass Cloudflare's TLS fingerprint check
#[tauri::command]
async fn search_hltb(title: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .use_native_tls()
        .build()
        .map_err(|e| format!("client build failed: {e}"))?;

    // Step 1: get security tokens
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let init_res = client
        .get(format!("{HLTB_BASE}/api/bleed/init?t={ts}"))
        .header("User-Agent", HLTB_UA)
        .header("Accept", "application/json, text/plain, */*")
        .header("Referer", format!("{HLTB_BASE}/"))
        .header("Origin", HLTB_BASE)
        .send()
        .await
        .map_err(|e| format!("[HLTB] init failed: {e}"))?;

    if !init_res.status().is_success() {
        return Err(format!("[HLTB] /api/bleed/init returned HTTP {}", init_res.status()));
    }

    let tokens: serde_json::Value = init_res.json().await
        .map_err(|e| format!("[HLTB] init parse failed: {e}"))?;

    let token  = tokens["token"].as_str().unwrap_or("").to_string();
    let hp_key = tokens["hpKey"].as_str().unwrap_or("").to_string();
    let hp_val = tokens["hpVal"].as_str().unwrap_or("").to_string();

    // Step 2: search
    let search_terms: Vec<&str> = title.split_whitespace().collect();
    let mut payload = serde_json::json!({
        "searchType": "games",
        "searchTerms": search_terms,
        "searchPage": 1,
        "size": 20,
        "searchOptions": {
            "games": {
                "userId": 0,
                "platform": "",
                "sortCategory": "popular",
                "rangeCategory": "main",
                "rangeTime": { "min": null, "max": null },
                "gameplay": { "perspective": "", "flow": "", "genre": "", "difficulty": "" },
                "rangeYear": { "min": "", "max": "" },
                "modifier": ""
            },
            "users": { "sortCategory": "postcount" },
            "lists": { "sortCategory": "follows" },
            "filter": "",
            "sort": 0,
            "randomizer": 0
        },
        "useCache": true
    });
    if !hp_key.is_empty() {
        payload[&hp_key] = serde_json::Value::String(hp_val.clone());
    }

    let search_res = client
        .post(format!("{HLTB_BASE}/api/bleed"))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/plain, */*")
        .header("Origin", HLTB_BASE)
        .header("Referer", format!("{HLTB_BASE}/"))
        .header("User-Agent", HLTB_UA)
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("x-auth-token", &token)
        .header("x-hp-key", &hp_key)
        .header("x-hp-val", &hp_val)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("[HLTB] search failed: {e}"))?;

    if !search_res.status().is_success() {
        return Err(format!("[HLTB] /api/bleed returned HTTP {}", search_res.status()));
    }

    let data: serde_json::Value = search_res.json().await
        .map_err(|e| format!("[HLTB] search parse failed: {e}"))?;

    Ok(data.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![search_hltb])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
