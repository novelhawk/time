use wasm_bindgen::prelude::*;

pub mod metadata;
pub mod models;
pub mod parser;
pub mod resolver;

#[wasm_bindgen]
pub fn engine_healthcheck() -> String {
    let count = jiff::tz::db().available().count();
    format!("{count}")
}

#[wasm_bindgen]
pub fn parse_query(input: &str) -> Result<JsValue, JsValue> {
    let asts = parser::parse_time_query(input);
    serde_wasm_bindgen::to_value(&asts).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn search_time_query(query: &str, reference_epoch_ms: f64, local_tz_name: &str) -> JsValue {
    let response = resolver::search_time_query(query, reference_epoch_ms, local_tz_name);
    serde_wasm_bindgen::to_value(&response).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn resolve_entries(entry_ids_js: JsValue, reference_epoch_ms: f64, local_tz_name: &str) -> JsValue {
    let ids: Vec<String> = serde_wasm_bindgen::from_value(entry_ids_js).unwrap_or_default();
    let entries = resolver::resolve_entries(&ids, reference_epoch_ms, local_tz_name);
    serde_wasm_bindgen::to_value(&entries).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn get_entry_details(entry_id: &str, reference_epoch_ms: f64, local_tz_name: &str) -> JsValue {
    let entry = resolver::get_entry_details(entry_id, reference_epoch_ms, local_tz_name);
    serde_wasm_bindgen::to_value(&entry).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_healthcheck() {
        let count_str = engine_healthcheck();
        println!("Available timezones: {count_str}");
        let count: usize = count_str.parse().expect("should parse to usize");
        assert!(count >= 590, "expected at least 590 timezones, got {count}");
    }
}
