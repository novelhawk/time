use wasm_bindgen::prelude::*;

pub mod parser;

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
