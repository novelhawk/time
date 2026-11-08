use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn engine_healthcheck() -> String {
    let count = jiff::tz::db().available().count();
    format!("{count}")
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
