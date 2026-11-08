use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AbbreviationBadge {
    pub code: String,              // e.g., "PT", "PST", "PDT", "CET", "CEST"
    pub full_name: String,         // e.g., "Pacific Time", "Central European Summer Time"
    pub kind: String,              // "generic_year_round" | "standard_seasonal" | "daylight_seasonal" | "fixed_year_round"
    pub is_currently_active: bool, // true for "PT" and whichever of "PST"/"PDT" is active right now
    pub is_year_round: bool,       // true for "PT" or "JST", false for "PST"/"PDT"/"CET"/"CEST" in DST zones
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DstTransitionInfo {
    pub timestamp_ms: i64,
    pub iso_utc: String,
    pub local_time_before: String,
    pub local_time_after: String,
    pub abbrev_before: String,
    pub abbrev_after: String,
    pub offset_before_seconds: i32,
    pub offset_after_seconds: i32,
    pub is_dst_after: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ResolvedTimeEntry {
    pub id: String,                     // Unique canonical ID, e.g. "iana:Europe/Rome", "offset:+01:00", "expr:Europe/Rome+05:00"
    pub kind: String,                   // "iana" | "offset_group" | "computed_expression"
    pub primary_label: String,          // Minimalist display label, e.g., "Europe/Rome", "UTC+01:00", "Local + 03:00"
    pub subtitle_context: Option<String>, // e.g., "Italy" or "Europe/Rome + 5h"
    pub formatted_time: String,         // "20:24:05"
    pub formatted_date: String,         // "2026-11-08"
    pub day_delta_from_local: i8,       // -1, 0, +1
    pub utc_offset_str: String,         // "UTC+01:00"
    pub gmt_offset_str: String,         // "GMT+1"
    pub local_offset_str: String,       // "Local +00:00" or "Local -06:00"
    pub offset_seconds: i32,
    pub uses_dst: bool,
    pub is_dst_active_now: bool,
    pub abbreviations: Vec<AbbreviationBadge>,
    pub previous_transition: Option<DstTransitionInfo>,
    pub next_transition: Option<DstTransitionInfo>,
    pub sibling_iana_zones: Vec<String>, // All IANA zones sharing this exact current offset (or DST regime)
    pub country_matches: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SearchResponse {
    pub parsed_expression_summary: Option<String>,
    pub is_ambiguous: bool,
    pub results: Vec<ResolvedTimeEntry>,
}
