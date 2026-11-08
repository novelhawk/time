use super::ast::{BaseZoneExpr, FlexibleDateTimeAst, OffsetDelta, TimeQueryAst};
use super::combinators::*;

/// Parses an offset sign: '+' -> +1, '-' -> -1
pub fn sign_p<'a>() -> Parser<'a, i8> {
    char_p('+')
        .map(|_| 1i8)
        .or_else(char_p('-').map(|_| -1i8))
}

/// Parses an offset delta, supporting:
/// - Colon format: `+ 5:30`, `- 02:30`, `+ 05:30:15`, `-3:30`
/// - Compound units: `+2h30m`, `+ 2h 30m`, `- 5h`, `+ 30m`, `+ 45s`, `+ 1h 15m 30s`
/// - Decimal hours: `+ 3.5`, `- 1.5`, `+2,5`
/// - Integer hours: `+ 3`, `- 5`
pub fn offset_delta_parser<'a>() -> Parser<'a, OffsetDelta> {
    // Optional leading spaces, sign, optional spaces between sign and magnitude
    spaces()
        .bind(|_| sign_p())
        .bind(|sign| {
            spaces().bind(move |_| {
                colon_offset_p()
                    .or_else(compound_units_offset_p())
                    .or_else(decimal_hours_offset_p())
                    .or_else(integer_hours_offset_p())
                    .map(move |(h, m, s)| OffsetDelta::new(sign, h, m, s))
            })
        })
}

/// Colon format: `HH:MM` or `HH:MM:SS` (e.g. `5:30`, `02:30`, `05:30:15`)
fn colon_offset_p<'a>() -> Parser<'a, (i32, i32, i32)> {
    u32_p().bind(|hours| {
        char_p(':').bind(move |_| {
            u32_p().bind(move |minutes| {
                opt(char_p(':').bind(|_| u32_p())).map(move |sec_opt| {
                    (hours as i32, minutes as i32, sec_opt.unwrap_or(0) as i32)
                })
            })
        })
    })
}

/// Compound unit format: `2h30m`, `5h`, `30min`, `45s`, `1h 15m 30s`
fn compound_units_offset_p<'a>() -> Parser<'a, (i32, i32, i32)> {
    Parser::new(|inp| {
        let mut cur = inp;
        let mut hours = 0i32;
        let mut minutes = 0i32;
        let mut seconds = 0i32;
        let mut matched_any = false;

        loop {
            // Skip spaces
            let trimmed = cur.trim_start();
            if trimmed.is_empty() {
                break;
            }

            // Try reading a number followed by unit (h/hr/hours, m/min/minutes, s/sec/seconds)
            let num_res = u32_p().parse(trimmed);
            if let Some((n, after_num)) = num_res.into_iter().next() {
                let unit_trimmed = after_num.trim_start();
                if let Some((_, rest)) = hours_unit_p().parse(unit_trimmed).into_iter().next() {
                    hours = n as i32;
                    cur = rest;
                    matched_any = true;
                    continue;
                } else if let Some((_, rest)) = minutes_unit_p().parse(unit_trimmed).into_iter().next() {
                    minutes = n as i32;
                    cur = rest;
                    matched_any = true;
                    continue;
                } else if let Some((_, rest)) = seconds_unit_p().parse(unit_trimmed).into_iter().next() {
                    seconds = n as i32;
                    cur = rest;
                    matched_any = true;
                    continue;
                }
            }
            break;
        }

        if matched_any {
            vec![((hours, minutes, seconds), cur)]
        } else {
            Vec::new()
        }
    })
}

fn hours_unit_p<'a>() -> Parser<'a, String> {
    ascii_ci_string("hours")
        .or_else(ascii_ci_string("hour"))
        .or_else(ascii_ci_string("hrs"))
        .or_else(ascii_ci_string("hr"))
        .or_else(ascii_ci_string("h"))
}

fn minutes_unit_p<'a>() -> Parser<'a, String> {
    ascii_ci_string("minutes")
        .or_else(ascii_ci_string("minute"))
        .or_else(ascii_ci_string("mins"))
        .or_else(ascii_ci_string("min"))
        .or_else(ascii_ci_string("m"))
}

fn seconds_unit_p<'a>() -> Parser<'a, String> {
    ascii_ci_string("seconds")
        .or_else(ascii_ci_string("second"))
        .or_else(ascii_ci_string("secs"))
        .or_else(ascii_ci_string("sec"))
        .or_else(ascii_ci_string("s"))
}

/// Decimal hours format: e.g. `3.5` -> 3h 30m, `2.25` -> 2h 15m
fn decimal_hours_offset_p<'a>() -> Parser<'a, (i32, i32, i32)> {
    u32_p().bind(|int_part| {
        char_p('.').or_else(char_p(',')).bind(move |_| {
            take_while1(|c| c.is_ascii_digit()).bind(move |frac_str| {
                let frac_val: f64 = format!("0.{}", frac_str).parse().unwrap_or(0.0);
                let total_min = (frac_val * 60.0).round() as i32;
                let minutes = total_min % 60;
                let extra_h = total_min / 60;
                let opt_unit = opt(hours_unit_p());
                opt_unit.map(move |_| (int_part as i32 + extra_h, minutes, 0))
            })
        })
    })
}

/// Integer hours format: e.g. `3` or `3h`
fn integer_hours_offset_p<'a>() -> Parser<'a, (i32, i32, i32)> {
    u32_p().bind(|h| {
        opt(hours_unit_p()).map(move |_| (h as i32, 0, 0))
    })
}

/// Parses base timezone expressions:
/// - Local / Here / Current / System
/// - UTC / Zulu / Z
/// - GMT
/// - IANA zone identifiers (e.g. `Europe/Rome`, `America/New_York`)
/// - Known abbreviations (e.g. `CET`, `CEST`, `PT`, `PST`, `IST`)
/// - Location queries (e.g. `Italy`, `Rome`, `Tokyo`, `New York`)
pub fn base_zone_parser<'a>() -> Parser<'a, BaseZoneExpr> {
    local_zone_p()
        .plus(utc_zone_p())
        .plus(gmt_zone_p())
        .plus(iana_zone_p())
        .plus(abbreviation_p())
        .plus(location_query_p())
}

fn local_zone_p<'a>() -> Parser<'a, BaseZoneExpr> {
    ascii_ci_string("local")
        .or_else(ascii_ci_string("here"))
        .or_else(ascii_ci_string("current"))
        .or_else(ascii_ci_string("system"))
        .or_else(ascii_ci_string("device"))
        .map(|_| BaseZoneExpr::Local)
}

fn utc_zone_p<'a>() -> Parser<'a, BaseZoneExpr> {
    ascii_ci_string("utc")
        .or_else(ascii_ci_string("zulu"))
        .or_else(
            char_ci('z')
                .bind(|_| Parser::new(|inp| {
                    // Only match 'Z' if at end of word / boundary
                    if inp.is_empty() || !inp.chars().next().unwrap().is_alphanumeric() {
                        vec![("z".to_string(), inp)]
                    } else {
                        Vec::new()
                    }
                }))
        )
        .map(|_| BaseZoneExpr::Utc)
}

fn gmt_zone_p<'a>() -> Parser<'a, BaseZoneExpr> {
    ascii_ci_string("gmt").map(|_| BaseZoneExpr::Gmt)
}

/// Parses IANA zone format: e.g. `Europe/Rome`, `America/Argentina/Buenos_Aires`, `Etc/GMT+4`
fn iana_zone_p<'a>() -> Parser<'a, BaseZoneExpr> {
    Parser::new(|inp| {
        let trimmed = inp.trim_start();
        let mut idx = 0;
        let mut slashes = 0;

        for c in trimmed.chars() {
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '+' {
                idx += c.len_utf8();
            } else if c == '/' {
                slashes += 1;
                idx += c.len_utf8();
            } else {
                break;
            }
        }

        if slashes >= 1 && idx > 2 {
            let candidate = &trimmed[..idx];
            // Don't end in a slash or operator
            if !candidate.ends_with('/') && !candidate.ends_with('+') && !candidate.ends_with('-') {
                return vec![(BaseZoneExpr::Iana(candidate.to_string()), &trimmed[idx..])];
            }
        }
        Vec::new()
    })
}

/// Parses standard timezone abbreviations (2 to 5 ASCII letters):
/// E.g. `CET`, `CEST`, `PST`, `PDT`, `PT`, `MST`, `MDT`, `MT`, `CST`, `CDT`, `CT`,
///      `EST`, `EDT`, `ET`, `IST`, `JST`, `KST`, `AEST`, `AEDT`, `UTC`, `GMT`, `BST`
fn abbreviation_p<'a>() -> Parser<'a, BaseZoneExpr> {
    Parser::new(|inp| {
        let trimmed = inp.trim_start();
        let mut len = 0;
        for c in trimmed.chars() {
            if c.is_ascii_alphabetic() {
                len += c.len_utf8();
            } else {
                break;
            }
        }

        if (2..=5).contains(&len) {
            let word = &trimmed[..len];
            let upper = word.to_ascii_uppercase();
            if is_known_abbreviation(&upper) {
                return vec![(BaseZoneExpr::Abbreviation(upper), &trimmed[len..])];
            }
        }
        Vec::new()
    })
}

pub fn is_known_abbreviation(abbr: &str) -> bool {
    matches!(
        abbr,
        "CET"
            | "CEST"
            | "EET"
            | "EEST"
            | "WET"
            | "WEST"
            | "PST"
            | "PDT"
            | "PT"
            | "MST"
            | "MDT"
            | "MT"
            | "CST"
            | "CDT"
            | "CT"
            | "EST"
            | "EDT"
            | "ET"
            | "AKST"
            | "AKDT"
            | "HST"
            | "HDT"
            | "IST"
            | "JST"
            | "KST"
            | "AEST"
            | "AEDT"
            | "ACST"
            | "ACDT"
            | "AWST"
            | "NZST"
            | "NZDT"
            | "BST"
            | "MSK"
            | "SGT"
            | "HKT"
            | "WIB"
            | "WITA"
            | "WIT"
            | "ART"
            | "BRT"
            | "CLT"
            | "CAT"
            | "EAT"
            | "WAT"
    )
}

/// Location query fallback: country/city names (e.g. `Italy`, `Rome`, `Tokyo`, `New York`, `San Francisco`)
fn location_query_p<'a>() -> Parser<'a, BaseZoneExpr> {
    Parser::new(|inp| {
        let trimmed = inp.trim_start();
        let mut idx = 0;
        let chars: Vec<char> = trimmed.chars().collect();
        let mut char_idx = 0;

        while char_idx < chars.len() {
            let c = chars[char_idx];
            if c.is_alphabetic() {
                idx += c.len_utf8();
                char_idx += 1;
            } else if (c == ' ' || c == '-' || c == '\'') && char_idx + 1 < chars.len() && chars[char_idx + 1].is_alphabetic() {
                // Check if followed by arithmetic sign like '+' or '-' or datetime '@'
                let rest_str = &trimmed[idx..].trim_start();
                if rest_str.starts_with('+') || rest_str.starts_with('-') || rest_str.starts_with('@') {
                    break;
                }
                idx += c.len_utf8();
                char_idx += 1;
            } else {
                break;
            }
        }

        if idx > 0 {
            let loc = trimmed[..idx].trim();
            if !loc.is_empty() {
                return vec![(BaseZoneExpr::LocationQuery(loc.to_string()), &trimmed[idx..])];
            }
        }
        Vec::new()
    })
}

/// Parses date & time expressions:
/// - Unix timestamp: `@1730000000`, `@ 1760000000`
/// - Combined date & time: `2026-07-15 14:30`, `2026-07-15T14:30:00`, `Jul 15 14:30`
/// - Standalone time: `14:30`, `14:30:15`, `2:30pm`, `9am`
/// - Standalone date: `2026-07-15`, `15/07/2026`, `Jul 15`, `July 15 2026`
pub fn flexible_datetime_parser<'a>() -> Parser<'a, FlexibleDateTimeAst> {
    spaces()
        .bind(|_| opt(char_p('@')).bind(|_| spaces()))
        .bind(|_| {
            unix_timestamp_p()
                .or_else(datetime_combined_p())
                .or_else(time_only_p())
                .or_else(date_only_p())
        })
}

fn unix_timestamp_p<'a>() -> Parser<'a, FlexibleDateTimeAst> {
    take_while1(|c| c.is_ascii_digit()).bind(|s| {
        if s.len() >= 9 {
            if let Ok(ts) = s.parse::<i64>() {
                return result(FlexibleDateTimeAst {
                    date: None,
                    time: None,
                    unix_timestamp: Some(ts),
                });
            }
        }
        zero()
    })
}

fn time_only_p<'a>() -> Parser<'a, FlexibleDateTimeAst> {
    time_parser().map(|time| FlexibleDateTimeAst {
        date: None,
        time: Some(time),
        unix_timestamp: None,
    })
}

fn date_only_p<'a>() -> Parser<'a, FlexibleDateTimeAst> {
    date_parser().map(|date| FlexibleDateTimeAst {
        date: Some(date),
        time: None,
        unix_timestamp: None,
    })
}

fn datetime_combined_p<'a>() -> Parser<'a, FlexibleDateTimeAst> {
    date_parser().bind(|date| {
        spaces()
            .bind(|_| opt(char_ci('t')).bind(|_| spaces()))
            .bind(move |_| {
                time_parser().map(move |time| FlexibleDateTimeAst {
                    date: Some(date),
                    time: Some(time),
                    unix_timestamp: None,
                })
            })
    })
}

/// Parses 24h or 12h time: `14:30`, `14:30:15`, `2:30pm`, `9am`, `11:45 PM`
fn time_parser<'a>() -> Parser<'a, (i8, i8, i8)> {
    u32_p().bind(|hours| {
        opt(char_p(':').bind(|_| u32_p())).bind(move |min_opt| {
            let min = min_opt.unwrap_or(0);
            opt(char_p(':').bind(|_| u32_p())).bind(move |sec_opt| {
                let sec = sec_opt.unwrap_or(0);
                spaces().bind(move |_| {
                    opt(am_pm_p()).bind(move |ampm| {
                        let mut h = hours as i8;
                        let m = min as i8;
                        let s = sec as i8;

                        if let Some(is_pm) = ampm {
                            if is_pm && h < 12 {
                                h += 12;
                            } else if !is_pm && h == 12 {
                                h = 0;
                            }
                        }

                        if (0..=23).contains(&h) && (0..=59).contains(&m) && (0..=59).contains(&s) {
                            result((h, m, s))
                        } else {
                            zero()
                        }
                    })
                })
            })
        })
    })
}

/// Returns true for PM, false for AM
fn am_pm_p<'a>() -> Parser<'a, bool> {
    ascii_ci_string("pm")
        .map(|_| true)
        .or_else(ascii_ci_string("am").map(|_| false))
        .or_else(char_ci('p').map(|_| true))
        .or_else(char_ci('a').map(|_| false))
}

/// Parses date: `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `Month Day Year`, `Month Day`
fn date_parser<'a>() -> Parser<'a, (i16, i8, i8)> {
    iso_date_p()
        .or_else(dmy_date_p())
        .or_else(month_name_date_p())
}

/// `YYYY-MM-DD` or `YYYY/MM/DD`
fn iso_date_p<'a>() -> Parser<'a, (i16, i8, i8)> {
    u32_p().bind(|year| {
        if year >= 1000 {
            char_p('-').or_else(char_p('/')).bind(move |_| {
                u32_p().bind(move |month| {
                    char_p('-').or_else(char_p('/')).bind(move |_| {
                        u32_p().bind(move |day| {
                            if (1..=12).contains(&month) && (1..=31).contains(&day) {
                                result((year as i16, month as i8, day as i8))
                            } else {
                                zero()
                            }
                        })
                    })
                })
            })
        } else {
            zero()
        }
    })
}

/// `DD/MM/YYYY` or `DD-MM-YYYY`
fn dmy_date_p<'a>() -> Parser<'a, (i16, i8, i8)> {
    u32_p().bind(|day| {
        if (1..=31).contains(&day) {
            char_p('/').or_else(char_p('-')).bind(move |_| {
                u32_p().bind(move |month| {
                    if (1..=12).contains(&month) {
                        char_p('/').or_else(char_p('-')).bind(move |_| {
                            u32_p().bind(move |year| {
                                let full_year = if year < 100 { 2000 + year as i16 } else { year as i16 };
                                result((full_year, month as i8, day as i8))
                            })
                        })
                    } else {
                        zero()
                    }
                })
            })
        } else {
            zero()
        }
    })
}

/// `Jul 15`, `July 15 2026`, `15 Jul 2026`
fn month_name_date_p<'a>() -> Parser<'a, (i16, i8, i8)> {
    month_p().bind(|month| {
        spaces().bind(move |_| {
            u32_p().bind(move |day| {
                opt(spaces().bind(|_| u32_p())).map(move |year_opt| {
                    let year = year_opt.unwrap_or(2026) as i16;
                    (year, month as i8, day as i8)
                })
            })
        })
    })
}

fn month_p<'a>() -> Parser<'a, u32> {
    ascii_ci_string("january").map(|_| 1)
        .or_else(ascii_ci_string("jan").map(|_| 1))
        .or_else(ascii_ci_string("february").map(|_| 2))
        .or_else(ascii_ci_string("feb").map(|_| 2))
        .or_else(ascii_ci_string("march").map(|_| 3))
        .or_else(ascii_ci_string("mar").map(|_| 3))
        .or_else(ascii_ci_string("april").map(|_| 4))
        .or_else(ascii_ci_string("apr").map(|_| 4))
        .or_else(ascii_ci_string("may").map(|_| 5))
        .or_else(ascii_ci_string("june").map(|_| 6))
        .or_else(ascii_ci_string("jun").map(|_| 6))
        .or_else(ascii_ci_string("july").map(|_| 7))
        .or_else(ascii_ci_string("jul").map(|_| 7))
        .or_else(ascii_ci_string("august").map(|_| 8))
        .or_else(ascii_ci_string("aug").map(|_| 8))
        .or_else(ascii_ci_string("september").map(|_| 9))
        .or_else(ascii_ci_string("sep").map(|_| 9))
        .or_else(ascii_ci_string("october").map(|_| 10))
        .or_else(ascii_ci_string("oct").map(|_| 10))
        .or_else(ascii_ci_string("november").map(|_| 11))
        .or_else(ascii_ci_string("nov").map(|_| 11))
        .or_else(ascii_ci_string("december").map(|_| 12))
        .or_else(ascii_ci_string("dec").map(|_| 12))
}

/// Parses compound timezone arithmetic:
/// E.g. `Local+3`, `Europe/Rome + 5`, `CET - 2`, `Italy + 1:30`, `Local + 2h - 30m @ 14:30`
pub fn zone_math_parser<'a>() -> Parser<'a, TimeQueryAst> {
    token(base_zone_parser()).bind(|base| {
        many(offset_delta_parser()).bind(move |deltas| {
            opt(flexible_datetime_parser()).map({
                let base = base.clone();
                let deltas = deltas.clone();
                move |at_time| TimeQueryAst::ZoneWithOffset {
                    base: base.clone(),
                    deltas: deltas.clone(),
                    at_time,
                }
            })
        })
    })
}

/// Parses pure offset queries:
/// E.g. `+02:00`, `-5`, `UTC+5:30`, `GMT-8`, `+05:30`
pub fn pure_offset_parser<'a>() -> Parser<'a, TimeQueryAst> {
    // Check if starts with UTC / GMT prefix
    let prefix_p = opt(ascii_ci_string("utc").or_else(ascii_ci_string("gmt")));
    prefix_p.bind(|_| {
        offset_delta_parser().bind(|delta| {
            opt(flexible_datetime_parser()).map(move |at_time| {
                TimeQueryAst::PureOffset {
                    total_seconds: delta.total_seconds(),
                    at_time,
                }
            })
        })
    })
}

/// Top-level time query parser:
/// Tries pure offset and zone-with-offset using `plus` (generating all ambiguous interpretations)
pub fn time_query_parser<'a>() -> Parser<'a, TimeQueryAst> {
    pure_offset_parser()
        .plus(zone_math_parser())
        .or_else(fuzzy_search_fallback())
}

/// Fallback parser capturing remaining input as fuzzy search
fn fuzzy_search_fallback<'a>() -> Parser<'a, TimeQueryAst> {
    take_while1(|_| true).map(|s| TimeQueryAst::FuzzySearch(s.trim().to_string()))
}

/// Top-level execution function
/// Parses a query string and returns all successful AST interpretations that consumed the input.
pub fn parse_time_query<'a>(input: &'a str) -> Vec<TimeQueryAst> {
    let raw = input.trim();
    if raw.is_empty() {
        return vec![TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Local,
            deltas: Vec::new(),
            at_time: None,
        }];
    }

    let mut successes = Vec::new();

    // 1. Try pure offset parser
    for (ast, rest) in pure_offset_parser().parse(raw) {
        if rest.trim().is_empty() {
            successes.push(ast);
        }
    }

    // 2. Try zone math parser
    for (ast, rest) in zone_math_parser().parse(raw) {
        if rest.trim().is_empty() {
            successes.push(ast);
        }
    }

    // Deduplicate
    let mut deduped: Vec<TimeQueryAst> = Vec::new();
    for item in successes {
        if !deduped.contains(&item) {
            deduped.push(item);
        }
    }

    if !deduped.is_empty() {
        deduped
    } else {
        vec![TimeQueryAst::FuzzySearch(raw.to_string())]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_local_plus_3() {
        let results = parse_time_query("Local+3");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Local,
            deltas: vec![OffsetDelta::new(1, 3, 0, 0)],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_europe_rome_plus_5() {
        let results = parse_time_query("Europe/Rome + 5");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Iana("Europe/Rome".to_string()),
            deltas: vec![OffsetDelta::new(1, 5, 0, 0)],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_utc_plus_0530_ambiguity() {
        let results = parse_time_query("UTC+05:30");
        assert!(!results.is_empty());

        let pure_offset = TimeQueryAst::PureOffset {
            total_seconds: 5 * 3600 + 30 * 60,
            at_time: None,
        };
        let zone_offset = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Utc,
            deltas: vec![OffsetDelta::new(1, 5, 30, 0)],
            at_time: None,
        };

        // Hutton-Meijer list of successes should include both interpretations
        assert!(results.contains(&pure_offset), "Expected PureOffset in {:?}", results);
        assert!(results.contains(&zone_offset), "Expected ZoneWithOffset in {:?}", results);
    }

    #[test]
    fn test_location_italy() {
        let results = parse_time_query("Italy");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::LocationQuery("Italy".to_string()),
            deltas: vec![],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_abbreviation_pt() {
        let results = parse_time_query("PT");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Abbreviation("PT".to_string()),
            deltas: vec![],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_ambiguous_cet() {
        let results = parse_time_query("CET");
        // "CET" is both a standard timezone abbreviation and can be parsed as a location query
        let abbr = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Abbreviation("CET".to_string()),
            deltas: vec![],
            at_time: None,
        };
        let loc = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::LocationQuery("CET".to_string()),
            deltas: vec![],
            at_time: None,
        };
        assert!(results.contains(&abbr), "Expected Abbr in {:?}", results);
        assert!(results.contains(&loc), "Expected LocationQuery in {:?}", results);
    }

    #[test]
    fn test_compound_deltas() {
        let results = parse_time_query("Local + 2 - 30m");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Local,
            deltas: vec![
                OffsetDelta::new(1, 2, 0, 0),
                OffsetDelta::new(-1, 0, 30, 0),
            ],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_with_flexible_datetime() {
        let results = parse_time_query("Europe/London + 2 @ 14:30");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Iana("Europe/London".to_string()),
            deltas: vec![OffsetDelta::new(1, 2, 0, 0)],
            at_time: Some(FlexibleDateTimeAst {
                date: None,
                time: Some((14, 30, 0)),
                unix_timestamp: None,
            }),
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_unix_timestamp() {
        let results = parse_time_query("UTC @ 1760000000");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Utc,
            deltas: vec![],
            at_time: Some(FlexibleDateTimeAst {
                date: None,
                time: None,
                unix_timestamp: Some(1760000000),
            }),
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_pure_offset_numeric() {
        let results = parse_time_query("-5");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::PureOffset {
            total_seconds: -5 * 3600,
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_iana_america_new_york() {
        let results = parse_time_query("America/New_York");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Iana("America/New_York".to_string()),
            deltas: vec![],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_utc_minus_3_30() {
        let results = parse_time_query("UTC-3:30");
        assert!(!results.is_empty());
        let expected_zone = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Utc,
            deltas: vec![OffsetDelta::new(-1, 3, 30, 0)],
            at_time: None,
        };
        let expected_pure = TimeQueryAst::PureOffset {
            total_seconds: -(3 * 3600 + 30 * 60),
            at_time: None,
        };
        assert!(results.contains(&expected_zone), "Expected ZoneWithOffset in {:?}", results);
        assert!(results.contains(&expected_pure), "Expected PureOffset in {:?}", results);
    }

    #[test]
    fn test_gmt_minus_8() {
        let results = parse_time_query("GMT-8");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::PureOffset {
            total_seconds: -8 * 3600,
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected PureOffset in {:?}", results);
    }

    #[test]
    fn test_plus_0200() {
        let results = parse_time_query("+02:00");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::PureOffset {
            total_seconds: 2 * 3600,
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected PureOffset in {:?}", results);
    }

    #[test]
    fn test_multi_word_location_san_francisco() {
        let results = parse_time_query("San Francisco - 2");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::LocationQuery("San Francisco".to_string()),
            deltas: vec![OffsetDelta::new(-1, 2, 0, 0)],
            at_time: None,
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_compound_hms_and_decimal() {
        let res_hms = parse_time_query("Local+2h30m");
        assert!(!res_hms.is_empty());
        assert!(res_hms.contains(&TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Local,
            deltas: vec![OffsetDelta::new(1, 2, 30, 0)],
            at_time: None,
        }));

        let res_dec = parse_time_query("Local+3.5");
        assert!(!res_dec.is_empty());
        assert!(res_dec.contains(&TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::Local,
            deltas: vec![OffsetDelta::new(1, 3, 30, 0)],
            at_time: None,
        }));
    }

    #[test]
    fn test_empty_string_defaults_to_local() {
        let results = parse_time_query("   ");
        assert_eq!(
            results,
            vec![TimeQueryAst::ZoneWithOffset {
                base: BaseZoneExpr::Local,
                deltas: vec![],
                at_time: None,
            }]
        );
    }

    #[test]
    fn test_full_datetime_iso_and_time() {
        let results = parse_time_query("Tokyo @ 2026-12-25 09:00:00");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::LocationQuery("Tokyo".to_string()),
            deltas: vec![],
            at_time: Some(FlexibleDateTimeAst {
                date: Some((2026, 12, 25)),
                time: Some((9, 0, 0)),
                unix_timestamp: None,
            }),
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_12h_time_with_am_pm() {
        let results = parse_time_query("Tokyo @ 2:30pm");
        assert!(!results.is_empty());
        let expected = TimeQueryAst::ZoneWithOffset {
            base: BaseZoneExpr::LocationQuery("Tokyo".to_string()),
            deltas: vec![],
            at_time: Some(FlexibleDateTimeAst {
                date: None,
                time: Some((14, 30, 0)),
                unix_timestamp: None,
            }),
        };
        assert!(results.contains(&expected), "Expected {:?} in {:?}", expected, results);
    }

    #[test]
    fn test_fuzzy_search_fallback() {
        let results = parse_time_query("??? random text !");
        assert_eq!(results, vec![TimeQueryAst::FuzzySearch("??? random text !".to_string())]);
    }
}
