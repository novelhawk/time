use std::collections::{BTreeMap, HashSet};
use jiff::tz::TimeZone;
use jiff::Timestamp;

use crate::metadata::{
    self, find_countries_by_query, find_countries_for_zone, get_abbreviations_for_zone,
    get_disambiguations_for_abbrev,
};
use crate::models::{
    DstTransitionInfo, ResolvedTimeEntry, SearchResponse,
};
use crate::parser::ast::{BaseZoneExpr, TimeQueryAst};
use crate::parser::parse_time_query;

/// Computes the detailed DST transition information for a transition
pub fn compute_dst_transition_info(
    tz: &TimeZone,
    trans: &jiff::tz::TimeZoneTransition,
) -> DstTransitionInfo {
    let trans_ts = trans.timestamp();
    let timestamp_ms = trans_ts.as_millisecond();
    let iso_utc = trans_ts.to_string();

    let zoned_after = trans_ts.to_zoned(tz.clone());
    let local_time_after = format!("{}", zoned_after.datetime());
    let abbrev_after = trans.abbreviation().to_string();
    let offset_after_seconds = trans.offset().seconds();
    let is_dst_after = trans.dst().is_dst();

    // 1 second before the transition instant
    let ts_before = Timestamp::from_second(trans_ts.as_second() - 1).unwrap_or(trans_ts);
    let zoned_before = ts_before.to_zoned(tz.clone());
    let local_time_before = format!("{}", zoned_before.datetime());

    // Abbreviation and offset active before this transition
    let prior_trans = tz.preceding(trans_ts).next();
    let abbrev_before = prior_trans
        .as_ref()
        .map(|t| t.abbreviation().to_string())
        .unwrap_or_else(|| abbrev_after.clone());
    let offset_before_seconds = prior_trans
        .as_ref()
        .map(|t| t.offset().seconds())
        .unwrap_or_else(|| zoned_before.offset().seconds());

    DstTransitionInfo {
        timestamp_ms,
        iso_utc,
        local_time_before,
        local_time_after,
        abbrev_before,
        abbrev_after,
        offset_before_seconds,
        offset_after_seconds,
        is_dst_after,
    }
}

/// Formats offset in seconds to UTC offset string (e.g. "UTC+01:00", "UTC-05:00", "UTC+00:00")
pub fn format_utc_offset(offset_seconds: i32) -> String {
    let sign = if offset_seconds < 0 { '-' } else { '+' };
    let abs_sec = offset_seconds.abs();
    let hours = abs_sec / 3600;
    let minutes = (abs_sec % 3600) / 60;
    format!("UTC{}{:02}:{:02}", sign, hours, minutes)
}

/// Formats offset in seconds to GMT offset string (e.g. "GMT+1", "GMT-5", "GMT+5:30", "GMT")
pub fn format_gmt_offset(offset_seconds: i32) -> String {
    if offset_seconds == 0 {
        return "GMT".to_string();
    }
    let sign = if offset_seconds < 0 { '-' } else { '+' };
    let abs_sec = offset_seconds.abs();
    let hours = abs_sec / 3600;
    let minutes = (abs_sec % 3600) / 60;
    if minutes == 0 {
        format!("GMT{}{}", sign, hours)
    } else {
        format!("GMT{}{}:{:02}", sign, hours, minutes)
    }
}

/// Formats local offset difference string (e.g. "Local +00:00", "Local -06:00")
pub fn format_local_offset_diff(target_offset_sec: i32, local_offset_sec: i32) -> String {
    let diff = target_offset_sec - local_offset_sec;
    if diff == 0 {
        return "Local +00:00".to_string();
    }
    let sign = if diff < 0 { '-' } else { '+' };
    let abs_diff = diff.abs();
    let hours = abs_diff / 3600;
    let minutes = (abs_diff % 3600) / 60;
    format!("Local {}{:02}:{:02}", sign, hours, minutes)
}

/// Returns all IANA timezone IDs currently sharing the given offset in seconds
pub fn get_sibling_zones_for_offset(offset_sec: i32, ts: Timestamp) -> Vec<String> {
    let mut siblings = Vec::new();
    for tz_name in jiff::tz::db().available() {
        let name = tz_name.as_str();
        // Filter out deprecated two-letter or raw posix rules, keeping standard slash regions
        if !name.contains('/') && name != "UTC" && name != "GMT" {
            continue;
        }
        if let Ok(tz) = TimeZone::get(name) {
            let zoned = ts.to_zoned(tz);
            if zoned.offset().seconds() == offset_sec {
                siblings.push(name.to_string());
            }
        }
    }
    siblings.sort();
    siblings
}

/// Builds a `ResolvedTimeEntry` for a specific IANA timezone
pub fn build_iana_entry(
    iana_name: &str,
    ts: Timestamp,
    local_tz: &TimeZone,
) -> Option<ResolvedTimeEntry> {
    let tz = TimeZone::get(iana_name).ok()?;
    let target_zoned = ts.to_zoned(tz.clone());
    let local_zoned = ts.to_zoned(local_tz.clone());

    let target_offset = target_zoned.offset().seconds();
    let local_offset = local_zoned.offset().seconds();

    // Check daylight saving time status
    let ts_probe = Timestamp::from_second(ts.as_second() + 1).unwrap_or(ts);
    let is_dst_active_now = tz
        .preceding(ts_probe)
        .next()
        .map(|t| t.dst().is_dst())
        .unwrap_or(false);

    let uses_dst = tz.following(ts).take(4).any(|t| t.dst().is_dst())
        || tz.preceding(ts).take(4).any(|t| t.dst().is_dst());

    let next_trans = tz.following(ts).next().map(|t| compute_dst_transition_info(&tz, &t));
    let prev_trans = tz.preceding(ts).next().map(|t| compute_dst_transition_info(&tz, &t));

    let day_delta = target_zoned
        .date()
        .since(local_zoned.date())
        .map(|span| span.get_days() as i8)
        .unwrap_or(0);

    let abbreviations = get_abbreviations_for_zone(iana_name, is_dst_active_now);
    let country_matches = find_countries_for_zone(iana_name);
    let sibling_iana_zones = get_sibling_zones_for_offset(target_offset, ts);

    let subtitle_context = if !country_matches.is_empty() {
        Some(country_matches.join(", "))
    } else {
        iana_name.split('/').next().map(|s| s.to_string())
    };

    Some(ResolvedTimeEntry {
        id: format!("iana:{}", iana_name),
        kind: "iana".to_string(),
        primary_label: iana_name.to_string(),
        subtitle_context,
        formatted_time: format!("{:02}:{:02}:{:02}", target_zoned.hour(), target_zoned.minute(), target_zoned.second()),
        formatted_date: format!("{:04}-{:02}-{:02}", target_zoned.year(), target_zoned.month(), target_zoned.day()),
        day_delta_from_local: day_delta,
        utc_offset_str: format_utc_offset(target_offset),
        gmt_offset_str: format_gmt_offset(target_offset),
        local_offset_str: format_local_offset_diff(target_offset, local_offset),
        offset_seconds: target_offset,
        uses_dst,
        is_dst_active_now,
        abbreviations,
        previous_transition: prev_trans,
        next_transition: next_trans,
        sibling_iana_zones,
        country_matches,
    })
}

/// Builds an `offset_group` entry representing all zones sharing an offset
pub fn build_offset_group_entry(
    offset_sec: i32,
    ts: Timestamp,
    local_tz: &TimeZone,
    representative_zone: Option<&str>,
) -> ResolvedTimeEntry {
    let local_zoned = ts.to_zoned(local_tz.clone());
    let local_offset = local_zoned.offset().seconds();

    let siblings = get_sibling_zones_for_offset(offset_sec, ts);
    let rep_name = representative_zone.unwrap_or_else(|| {
        siblings.first().map(|s| s.as_str()).unwrap_or("UTC")
    });

    // Extract transition and DST info from the representative zone
    let rep_tz = TimeZone::get(rep_name).unwrap_or_else(|_| TimeZone::UTC);
    let ts_probe = Timestamp::from_second(ts.as_second() + 1).unwrap_or(ts);
    let is_dst_active_now = rep_tz
        .preceding(ts_probe)
        .next()
        .map(|t| t.dst().is_dst())
        .unwrap_or(false);
    let uses_dst = rep_tz.following(ts).take(4).any(|t| t.dst().is_dst())
        || rep_tz.preceding(ts).take(4).any(|t| t.dst().is_dst());

    let next_trans = rep_tz.following(ts).next().map(|t| compute_dst_transition_info(&rep_tz, &t));
    let prev_trans = rep_tz.preceding(ts).next().map(|t| compute_dst_transition_info(&rep_tz, &t));

    // Target civil time using fixed offset
    let target_tz = TimeZone::fixed(
        jiff::tz::Offset::from_seconds(offset_sec).unwrap_or(jiff::tz::Offset::UTC),
    );
    let target_zoned = ts.to_zoned(target_tz);

    let day_delta = target_zoned
        .date()
        .since(local_zoned.date())
        .map(|span| span.get_days() as i8)
        .unwrap_or(0);

    let abbreviations = get_abbreviations_for_zone(rep_name, is_dst_active_now);

    // Collect country matches across siblings
    let mut countries = Vec::new();
    for sib in &siblings {
        for c in find_countries_for_zone(sib) {
            if !countries.contains(&c) {
                countries.push(c);
            }
        }
    }

    let sample_cities: Vec<&str> = siblings
        .iter()
        .take(3)
        .map(|s| s.split('/').last().unwrap_or(s))
        .collect();

    let subtitle = if !siblings.is_empty() {
        format!("{} zones ({})", siblings.len(), sample_cities.join(", "))
    } else {
        "Fixed Offset Regime".to_string()
    };

    let sign = if offset_sec < 0 { '-' } else { '+' };
    let abs_sec = offset_sec.abs();
    let id = format!("offset:{}{:02}:{:02}", sign, abs_sec / 3600, (abs_sec % 3600) / 60);

    ResolvedTimeEntry {
        id,
        kind: "offset_group".to_string(),
        primary_label: format_utc_offset(offset_sec),
        subtitle_context: Some(subtitle),
        formatted_time: format!("{:02}:{:02}:{:02}", target_zoned.hour(), target_zoned.minute(), target_zoned.second()),
        formatted_date: format!("{:04}-{:02}-{:02}", target_zoned.year(), target_zoned.month(), target_zoned.day()),
        day_delta_from_local: day_delta,
        utc_offset_str: format_utc_offset(offset_sec),
        gmt_offset_str: format_gmt_offset(offset_sec),
        local_offset_str: format_local_offset_diff(offset_sec, local_offset),
        offset_seconds: offset_sec,
        uses_dst,
        is_dst_active_now,
        abbreviations,
        previous_transition: prev_trans,
        next_transition: next_trans,
        sibling_iana_zones: siblings,
        country_matches: countries,
    }
}

/// Builds a `computed_expression` entry for mathematical offset calculations
pub fn build_computed_expression_entry(
    label: &str,
    offset_sec: i32,
    ts: Timestamp,
    local_tz: &TimeZone,
    expression_summary: Option<String>,
) -> ResolvedTimeEntry {
    let local_zoned = ts.to_zoned(local_tz.clone());
    let local_offset = local_zoned.offset().seconds();

    let target_tz = TimeZone::fixed(
        jiff::tz::Offset::from_seconds(offset_sec).unwrap_or(jiff::tz::Offset::UTC),
    );
    let target_zoned = ts.to_zoned(target_tz);

    let day_delta = target_zoned
        .date()
        .since(local_zoned.date())
        .map(|span| span.get_days() as i8)
        .unwrap_or(0);

    let siblings = get_sibling_zones_for_offset(offset_sec, ts);
    let sign = if offset_sec < 0 { '-' } else { '+' };
    let abs_sec = offset_sec.abs();
    let id = format!("expr:{}{:02}:{:02}", sign, abs_sec / 3600, (abs_sec % 3600) / 60);

    ResolvedTimeEntry {
        id,
        kind: "computed_expression".to_string(),
        primary_label: label.to_string(),
        subtitle_context: expression_summary.or_else(|| Some("Calculated Timezone Expression".to_string())),
        formatted_time: format!("{:02}:{:02}:{:02}", target_zoned.hour(), target_zoned.minute(), target_zoned.second()),
        formatted_date: format!("{:04}-{:02}-{:02}", target_zoned.year(), target_zoned.month(), target_zoned.day()),
        day_delta_from_local: day_delta,
        utc_offset_str: format_utc_offset(offset_sec),
        gmt_offset_str: format_gmt_offset(offset_sec),
        local_offset_str: format_local_offset_diff(offset_sec, local_offset),
        offset_seconds: offset_sec,
        uses_dst: false,
        is_dst_active_now: false,
        abbreviations: Vec::new(),
        previous_transition: None,
        next_transition: None,
        sibling_iana_zones: siblings,
        country_matches: Vec::new(),
    }
}

/// Main search entry point
pub fn search_time_query(
    query: &str,
    reference_epoch_ms: f64,
    local_tz_name: &str,
) -> SearchResponse {
    let ts = Timestamp::from_millisecond(reference_epoch_ms as i64)
        .unwrap_or_else(|_| Timestamp::now());
    let local_tz = TimeZone::get(local_tz_name).unwrap_or_else(|_| TimeZone::UTC);

    let raw = query.trim();
    if raw.is_empty() {
        let local_entry = build_iana_entry(local_tz_name, ts, &local_tz).unwrap_or_else(|| {
            let off = ts.to_zoned(local_tz.clone()).offset().seconds();
            build_offset_group_entry(off, ts, &local_tz, None)
        });
        return SearchResponse {
            parsed_expression_summary: Some("Local Time".to_string()),
            is_ambiguous: false,
            results: vec![local_entry],
        };
    }

    // 1. Run the Hutton-Meijer Parser
    let parsed_asts = parse_time_query(raw);
    let is_ambiguous = parsed_asts.len() > 1;

    let mut results: Vec<ResolvedTimeEntry> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    // Check if any parse represents a mathematical expression with deltas
    let mut has_mathematical_expression = false;
    for ast in &parsed_asts {
        if let TimeQueryAst::ZoneWithOffset { deltas, .. } = ast {
            if !deltas.is_empty() {
                has_mathematical_expression = true;
                break;
            }
        }
    }

    // Process each AST parse interpretation
    for ast in &parsed_asts {
        match ast {
            TimeQueryAst::ZoneWithOffset { base, deltas, at_time } => {
                // Resolve base timezone
                let (base_tz, base_label) = match base {
                    BaseZoneExpr::Local => (local_tz.clone(), "Local".to_string()),
                    BaseZoneExpr::Utc => (TimeZone::UTC, "UTC".to_string()),
                    BaseZoneExpr::Gmt => (TimeZone::get("GMT").unwrap_or(TimeZone::UTC), "GMT".to_string()),
                    BaseZoneExpr::Iana(name) => {
                        let tz = TimeZone::get(name).unwrap_or(TimeZone::UTC);
                        (tz, name.clone())
                    }
                    BaseZoneExpr::Abbreviation(abbr) => {
                        let rep = resolve_abbreviation_to_zone(abbr);
                        let tz = TimeZone::get(&rep).unwrap_or(TimeZone::UTC);
                        (tz, abbr.clone())
                    }
                    BaseZoneExpr::LocationQuery(loc) => {
                        let rep = resolve_location_to_zone(loc).unwrap_or_else(|| "UTC".to_string());
                        let tz = TimeZone::get(&rep).unwrap_or(TimeZone::UTC);
                        (tz, loc.clone())
                    }
                    BaseZoneExpr::FixedOffsetSeconds(sec) => {
                        let tz = TimeZone::fixed(
                            jiff::tz::Offset::from_seconds(*sec).unwrap_or(jiff::tz::Offset::UTC),
                        );
                        (tz, format_utc_offset(*sec))
                    }
                };

                let reference_ts = if let Some(dt) = at_time {
                    if let Some(unix_ts) = dt.unix_timestamp {
                        Timestamp::from_second(unix_ts).unwrap_or(ts)
                    } else if dt.date.is_some() || dt.time.is_some() {
                        let base_zoned = ts.to_zoned(base_tz.clone());
                        let (y, m, d) = dt.date.unwrap_or_else(|| {
                            (base_zoned.year(), base_zoned.month(), base_zoned.day())
                        });
                        let (h, min, s) = dt.time.unwrap_or_else(|| {
                            (base_zoned.hour(), base_zoned.minute(), base_zoned.second())
                        });
                        let civil_date = jiff::civil::date(y, m, d);
                        let civil_time = jiff::civil::time(h, min, s, 0);
                        let civil_dt = civil_date.to_datetime(civil_time);
                        base_tz
                            .to_zoned(civil_dt)
                            .map(|z| z.timestamp())
                            .unwrap_or(ts)
                    } else {
                        ts
                    }
                } else {
                    ts
                };

                let base_offset = reference_ts.to_zoned(base_tz.clone()).offset().seconds();

                if !deltas.is_empty() {
                    // Mathematical expression (e.g. Local+3, Europe/Rome + 5)
                    let delta_sec: i32 = deltas.iter().map(|d| d.total_seconds()).sum();
                    let final_offset = base_offset + delta_sec;

                    let mut delta_label = String::new();
                    for d in deltas {
                        let s = if d.sign < 0 { '-' } else { '+' };
                        delta_label.push_str(&format!(" {} {:02}:{:02}", s, d.hours, d.minutes));
                    }
                    let expr_label = format!("{}{}", base_label, delta_label);

                    let computed_entry = build_computed_expression_entry(
                        &expr_label,
                        final_offset,
                        reference_ts,
                        &local_tz,
                        Some(format!("Shifted from {} ({})", base_label, format_utc_offset(base_offset))),
                    );

                    let offset_group = build_offset_group_entry(final_offset, reference_ts, &local_tz, None);

                    if seen_ids.insert(computed_entry.id.clone()) {
                        results.push(computed_entry);
                    }
                    if seen_ids.insert(offset_group.id.clone()) {
                        results.push(offset_group);
                    }
                } else {
                    // Base zone without deltas
                    match base {
                        BaseZoneExpr::LocationQuery(loc) => {
                            // Country / Location search (e.g. "Italy")
                            // Return BOTH the offset group AND the specific IANA entry directly below it!
                            if let Some(countries) = find_countries_by_query(loc).first() {
                                for &zone_name in countries.primary_zones {
                                    if let Some(iana_entry) = build_iana_entry(zone_name, reference_ts, &local_tz) {
                                        let offset_group = build_offset_group_entry(
                                            iana_entry.offset_seconds,
                                            reference_ts,
                                            &local_tz,
                                            Some(zone_name),
                                        );
                                        if seen_ids.insert(offset_group.id.clone()) {
                                            results.push(offset_group);
                                        }
                                        if seen_ids.insert(iana_entry.id.clone()) {
                                            results.push(iana_entry);
                                        }
                                    }
                                }
                            } else if let Some(iana_name) = resolve_location_to_zone(loc) {
                                if let Some(iana_entry) = build_iana_entry(&iana_name, reference_ts, &local_tz) {
                                    let offset_group = build_offset_group_entry(
                                        iana_entry.offset_seconds,
                                        reference_ts,
                                        &local_tz,
                                        Some(&iana_name),
                                    );
                                    if seen_ids.insert(offset_group.id.clone()) {
                                        results.push(offset_group);
                                    }
                                    if seen_ids.insert(iana_entry.id.clone()) {
                                        results.push(iana_entry);
                                    }
                                }
                            }
                        }
                        BaseZoneExpr::Iana(name) => {
                            if let Some(iana_entry) = build_iana_entry(name, reference_ts, &local_tz) {
                                if seen_ids.insert(iana_entry.id.clone()) {
                                    results.push(iana_entry);
                                }
                            }
                        }
                        BaseZoneExpr::Abbreviation(abbr) => {
                            // Check for disambiguation
                            if let Some(disambiguations) = get_disambiguations_for_abbrev(abbr) {
                                for dis in disambiguations {
                                    if let Some(iana_entry) = build_iana_entry(dis.primary_iana, reference_ts, &local_tz) {
                                        let offset_group = build_offset_group_entry(
                                            iana_entry.offset_seconds,
                                            reference_ts,
                                            &local_tz,
                                            Some(dis.primary_iana),
                                        );
                                        if seen_ids.insert(offset_group.id.clone()) {
                                            results.push(offset_group);
                                        }
                                        if seen_ids.insert(iana_entry.id.clone()) {
                                            results.push(iana_entry);
                                        }
                                    }
                                }
                            } else {
                                let zone_name = resolve_abbreviation_to_zone(abbr);
                                if let Some(iana_entry) = build_iana_entry(&zone_name, reference_ts, &local_tz) {
                                    let offset_group = build_offset_group_entry(
                                        iana_entry.offset_seconds,
                                        reference_ts,
                                        &local_tz,
                                        Some(&zone_name),
                                    );
                                    if seen_ids.insert(offset_group.id.clone()) {
                                        results.push(offset_group);
                                    }
                                    if seen_ids.insert(iana_entry.id.clone()) {
                                        results.push(iana_entry);
                                    }
                                }
                            }
                        }
                        BaseZoneExpr::Local | BaseZoneExpr::Utc | BaseZoneExpr::Gmt => {
                            let zone_name = match base {
                                BaseZoneExpr::Local => local_tz_name,
                                BaseZoneExpr::Utc => "UTC",
                                BaseZoneExpr::Gmt => "GMT",
                                _ => unreachable!(),
                            };
                            if let Some(entry) = build_iana_entry(zone_name, reference_ts, &local_tz) {
                                if seen_ids.insert(entry.id.clone()) {
                                    results.push(entry);
                                }
                            }
                        }
                        BaseZoneExpr::FixedOffsetSeconds(sec) => {
                            let entry = build_offset_group_entry(*sec, reference_ts, &local_tz, None);
                            if seen_ids.insert(entry.id.clone()) {
                                results.push(entry);
                            }
                        }
                    }
                }
            }
            TimeQueryAst::PureOffset { total_seconds, at_time } => {
                let reference_ts = if let Some(dt) = at_time {
                    if let Some(unix_ts) = dt.unix_timestamp {
                        Timestamp::from_second(unix_ts).unwrap_or(ts)
                    } else if dt.date.is_some() || dt.time.is_some() {
                        let local_zoned = ts.to_zoned(local_tz.clone());
                        let (y, m, d) = dt.date.unwrap_or_else(|| {
                            (local_zoned.year(), local_zoned.month(), local_zoned.day())
                        });
                        let (h, min, s) = dt.time.unwrap_or_else(|| {
                            (local_zoned.hour(), local_zoned.minute(), local_zoned.second())
                        });
                        let civil_date = jiff::civil::date(y, m, d);
                        let civil_time = jiff::civil::time(h, min, s, 0);
                        let civil_dt = civil_date.to_datetime(civil_time);
                        local_tz
                            .to_zoned(civil_dt)
                            .map(|z| z.timestamp())
                            .unwrap_or(ts)
                    } else {
                        ts
                    }
                } else {
                    ts
                };
                let entry = build_offset_group_entry(*total_seconds, reference_ts, &local_tz, None);
                if seen_ids.insert(entry.id.clone()) {
                    results.push(entry);
                }
            }
            TimeQueryAst::FuzzySearch(term) => {
                // If nothing else matched, search countries and cities
                let country_matches = find_countries_by_query(term);
                for c in country_matches {
                    for &z in c.primary_zones {
                        if let Some(entry) = build_iana_entry(z, ts, &local_tz) {
                            let grp = build_offset_group_entry(entry.offset_seconds, ts, &local_tz, Some(z));
                            if seen_ids.insert(grp.id.clone()) {
                                results.push(grp);
                            }
                            if seen_ids.insert(entry.id.clone()) {
                                results.push(entry);
                            }
                        }
                    }
                }
            }
        }
    }

    // Deduplication rule: for broad searches (e.g. "Europe", "America"), group zones sharing the same offset
    // into a single offset_group, and cap individual IANA city rows to top 3 direct matches.
    if !has_mathematical_expression && results.is_empty() {
        // Fallback search over all IANA zones
        let query_lower = raw.to_lowercase();
        let mut matching_zones: Vec<String> = Vec::new();

        for tz_name in jiff::tz::db().available() {
            let name = tz_name.as_str();
            if name.to_lowercase().contains(&query_lower) {
                matching_zones.push(name.to_string());
            }
        }

        let mut offset_groups_map: BTreeMap<i32, Vec<String>> = BTreeMap::new();
        for z in &matching_zones {
            if let Ok(tz) = TimeZone::get(z) {
                let off = ts.to_zoned(tz).offset().seconds();
                offset_groups_map.entry(off).or_default().push(z.clone());
            }
        }

        // Top 3 individual city matches
        let direct_city_matches: Vec<&String> = matching_zones.iter().take(3).collect();
        for city in direct_city_matches {
            if let Some(entry) = build_iana_entry(city, ts, &local_tz) {
                if seen_ids.insert(entry.id.clone()) {
                    results.push(entry);
                }
            }
        }

        // Grouped offset cards for the remaining
        for (off, zones) in offset_groups_map {
            let grp = build_offset_group_entry(off, ts, &local_tz, zones.first().map(|s| s.as_str()));
            if seen_ids.insert(grp.id.clone()) {
                results.push(grp);
            }
        }
    }

    SearchResponse {
        parsed_expression_summary: Some(raw.to_string()),
        is_ambiguous,
        results,
    }
}

/// Helper resolving an abbreviation code to a primary IANA timezone
fn resolve_abbreviation_to_zone(abbr: &str) -> String {
    for def in metadata::ABBREV_FAMILIES {
        if let Some((code, _)) = def.generic {
            if code.eq_ignore_ascii_case(abbr) {
                return def.zones.first().unwrap().to_string();
            }
        }
        if let Some((code, _)) = def.standard {
            if code.eq_ignore_ascii_case(abbr) {
                return def.zones.first().unwrap().to_string();
            }
        }
        if let Some((code, _)) = def.daylight {
            if code.eq_ignore_ascii_case(abbr) {
                return def.zones.first().unwrap().to_string();
            }
        }
        if let Some((code, _)) = def.fixed {
            if code.eq_ignore_ascii_case(abbr) {
                return def.zones.first().unwrap().to_string();
            }
        }
    }
    // Fallback if abbreviation matches an IANA zone suffix
    "UTC".to_string()
}

/// Helper resolving a city/location query to a primary IANA timezone
fn resolve_location_to_zone(loc: &str) -> Option<String> {
    let loc_clean = loc.trim().to_lowercase().replace(' ', "_");

    // Exact IANA match check
    for tz_name in jiff::tz::db().available() {
        let name = tz_name.as_str();
        if name.to_lowercase().ends_with(&format!("/{}", loc_clean)) || name.to_lowercase() == loc_clean {
            return Some(name.to_string());
        }
    }

    // Country match check
    let countries = find_countries_by_query(loc);
    if let Some(c) = countries.first() {
        if let Some(&first_zone) = c.primary_zones.first() {
            return Some(first_zone.to_string());
        }
    }

    None
}

/// Resolves multiple entry IDs
pub fn resolve_entries(
    entry_ids: &[String],
    reference_epoch_ms: f64,
    local_tz_name: &str,
) -> Vec<ResolvedTimeEntry> {
    let ts = Timestamp::from_millisecond(reference_epoch_ms as i64)
        .unwrap_or_else(|_| Timestamp::now());
    let local_tz = TimeZone::get(local_tz_name).unwrap_or_else(|_| TimeZone::UTC);

    let mut entries = Vec::new();
    for id in entry_ids {
        if let Some(entry) = resolve_single_id(id, ts, &local_tz) {
            entries.push(entry);
        }
    }
    entries
}

/// Resolves a single entry ID
pub fn get_entry_details(
    entry_id: &str,
    reference_epoch_ms: f64,
    local_tz_name: &str,
) -> Option<ResolvedTimeEntry> {
    let ts = Timestamp::from_millisecond(reference_epoch_ms as i64)
        .unwrap_or_else(|_| Timestamp::now());
    let local_tz = TimeZone::get(local_tz_name).unwrap_or_else(|_| TimeZone::UTC);

    resolve_single_id(entry_id, ts, &local_tz)
}

fn resolve_single_id(id: &str, ts: Timestamp, local_tz: &TimeZone) -> Option<ResolvedTimeEntry> {
    if id == "local" {
        let local_name = local_tz.iana_name().unwrap_or("UTC");
        let mut entry = build_iana_entry(local_name, ts, local_tz)?;
        entry.id = "local".to_string();
        entry.primary_label = format!("Local ({})", local_name);
        return Some(entry);
    }
    if let Some(name) = id.strip_prefix("iana:") {
        build_iana_entry(name, ts, local_tz)
    } else if let Some(offset_str) = id.strip_prefix("offset:") {
        let sec = parse_offset_string_to_seconds(offset_str)?;
        Some(build_offset_group_entry(sec, ts, local_tz, None))
    } else if let Some(expr_str) = id.strip_prefix("expr:") {
        let sec = parse_offset_string_to_seconds(expr_str)?;
        Some(build_computed_expression_entry(
            &format!("Shifted Timezone ({})", format_utc_offset(sec)),
            sec,
            ts,
            local_tz,
            Some("Persisted Expression".to_string()),
        ))
    } else {
        None
    }
}

fn parse_offset_string_to_seconds(s: &str) -> Option<i32> {
    let s = s.trim();
    let (sign, rest) = if let Some(stripped) = s.strip_prefix('-') {
        (-1, stripped)
    } else if let Some(stripped) = s.strip_prefix('+') {
        (1, stripped)
    } else {
        (1, s)
    };

    let parts: Vec<&str> = rest.split(':').collect();
    let hours: i32 = parts.first()?.parse().ok()?;
    let minutes: i32 = if parts.len() > 1 {
        parts[1].parse().ok()?
    } else {
        0
    };

    Some(sign * (hours * 3600 + minutes * 60))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_italy_returns_offset_group_and_rome() {
        let ref_ms = 1794000000000.0; // Reference timestamp in ms
        let res = search_time_query("Italy", ref_ms, "UTC");

        assert!(!res.results.is_empty(), "Results should not be empty");

        // Must return both an offset_group and Europe/Rome
        let has_offset_group = res.results.iter().any(|r| r.kind == "offset_group");
        let has_rome = res.results.iter().any(|r| r.id == "iana:Europe/Rome");

        assert!(has_offset_group, "Should return an offset_group for Italy");
        assert!(has_rome, "Should return Europe/Rome for Italy");
    }

    #[test]
    fn test_search_local_plus_3() {
        let ref_ms = 1794000000000.0;
        let res = search_time_query("Local+3", ref_ms, "Europe/London");

        let has_expr = res.results.iter().any(|r| r.kind == "computed_expression");
        let has_group = res.results.iter().any(|r| r.kind == "offset_group");

        assert!(has_expr, "Should return computed_expression");
        assert!(has_group, "Should return target offset_group");

        // Resulting offset should have matching IANA zones
        let expr_entry = res.results.iter().find(|r| r.kind == "computed_expression").unwrap();
        assert!(!expr_entry.sibling_iana_zones.is_empty(), "Should list matching IANA zones for shifted offset");
    }

    #[test]
    fn test_search_europe_rome_plus_5() {
        let ref_ms = 1794000000000.0;
        let res = search_time_query("Europe/Rome + 5", ref_ms, "UTC");

        let has_expr = res.results.iter().any(|r| r.kind == "computed_expression");
        assert!(has_expr, "Should return computed_expression");

        let expr_entry = res.results.iter().find(|r| r.kind == "computed_expression").unwrap();
        assert!(!expr_entry.sibling_iana_zones.is_empty(), "Should list matching IANA zones for Rome+5");
    }

    #[test]
    fn test_america_los_angeles_dst_and_abbreviations() {
        let ref_ms = 1731099600000.0; // Nov 8, 2024 (standard PST time)
        let local_tz = TimeZone::UTC;
        let ts = Timestamp::from_millisecond(ref_ms as i64).unwrap();

        let entry = build_iana_entry("America/Los_Angeles", ts, &local_tz).unwrap();

        assert_eq!(entry.id, "iana:America/Los_Angeles");
        assert!(entry.uses_dst, "Los Angeles observes DST");
        assert!(!entry.is_dst_active_now, "Nov 8 is in Standard Time (PST)");

        // Badges: PT (generic year round), PST (active standard seasonal), PDT (inactive daylight seasonal)
        let pt = entry.abbreviations.iter().find(|b| b.code == "PT").expect("PT badge missing");
        assert!(pt.is_year_round);
        assert!(pt.is_currently_active);

        let pst = entry.abbreviations.iter().find(|b| b.code == "PST").expect("PST badge missing");
        assert!(!pst.is_year_round);
        assert!(pst.is_currently_active);

        let pdt = entry.abbreviations.iter().find(|b| b.code == "PDT").expect("PDT badge missing");
        assert!(!pdt.is_year_round);
        assert!(!pdt.is_currently_active);

        // Exact previous and next transitions
        assert!(entry.previous_transition.is_some(), "Should have previous transition");
        assert!(entry.next_transition.is_some(), "Should have next transition");

        let prev = entry.previous_transition.unwrap();
        assert_eq!(prev.abbrev_after, "PST");

        let next = entry.next_transition.unwrap();
        assert_eq!(next.abbrev_after, "PDT");
        assert!(next.is_dst_after);
    }

    #[test]
    fn test_resolve_default_entries() {
        let ref_ms = 1731099600000.0;
        let ids = vec!["local".to_string(), "iana:UTC".to_string()];
        let entries = resolve_entries(&ids, ref_ms, "Europe/Rome");

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].id, "local");
        assert_eq!(entries[0].primary_label, "Local (Europe/Rome)");
        assert_eq!(entries[1].id, "iana:UTC");
        assert_eq!(entries[1].primary_label, "UTC");
    }
}
