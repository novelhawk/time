use crate::models::AbbreviationBadge;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AbbrevKind {
    GenericYearRound,
    StandardSeasonal,
    DaylightSeasonal,
    FixedYearRound,
}

impl AbbrevKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            AbbrevKind::GenericYearRound => "generic_year_round",
            AbbrevKind::StandardSeasonal => "standard_seasonal",
            AbbrevKind::DaylightSeasonal => "daylight_seasonal",
            AbbrevKind::FixedYearRound => "fixed_year_round",
        }
    }

    pub fn is_year_round(&self) -> bool {
        matches!(self, AbbrevKind::GenericYearRound | AbbrevKind::FixedYearRound)
    }
}

pub struct AbbrevFamilyDef {
    pub zones: &'static [&'static str],
    pub generic: Option<(&'static str, &'static str)>,   // (code, full_name)
    pub standard: Option<(&'static str, &'static str)>,  // (code, full_name)
    pub daylight: Option<(&'static str, &'static str)>,  // (code, full_name)
    pub fixed: Option<(&'static str, &'static str)>,     // (code, full_name)
}

pub const ABBREV_FAMILIES: &[AbbrevFamilyDef] = &[
    // North American Pacific
    AbbrevFamilyDef {
        zones: &[
            "America/Los_Angeles",
            "America/Vancouver",
            "America/Tijuana",
            "PST8PDT",
        ],
        generic: Some(("PT", "Pacific Time")),
        standard: Some(("PST", "Pacific Standard Time")),
        daylight: Some(("PDT", "Pacific Daylight Time")),
        fixed: None,
    },
    // North American Mountain
    AbbrevFamilyDef {
        zones: &["America/Denver", "America/Edmonton", "MST7MDT"],
        generic: Some(("MT", "Mountain Time")),
        standard: Some(("MST", "Mountain Standard Time")),
        daylight: Some(("MDT", "Mountain Daylight Time")),
        fixed: None,
    },
    // Arizona / Mountain Standard fixed
    AbbrevFamilyDef {
        zones: &["America/Phoenix"],
        generic: Some(("MT", "Mountain Time")),
        standard: None,
        daylight: None,
        fixed: Some(("MST", "Mountain Standard Time")),
    },
    // North American Central
    AbbrevFamilyDef {
        zones: &[
            "America/Chicago",
            "America/Winnipeg",
            "America/Mexico_City",
            "America/Monterrey",
            "CST6CDT",
        ],
        generic: Some(("CT", "Central Time")),
        standard: Some(("CST", "Central Standard Time")),
        daylight: Some(("CDT", "Central Daylight Time")),
        fixed: None,
    },
    // North American Eastern
    AbbrevFamilyDef {
        zones: &[
            "America/New_York",
            "America/Toronto",
            "America/Montreal",
            "America/Detroit",
            "America/Indiana/Indianapolis",
            "EST5EDT",
        ],
        generic: Some(("ET", "Eastern Time")),
        standard: Some(("EST", "Eastern Standard Time")),
        daylight: Some(("EDT", "Eastern Daylight Time")),
        fixed: None,
    },
    // Atlantic
    AbbrevFamilyDef {
        zones: &["America/Halifax", "America/Moncton"],
        generic: Some(("AT", "Atlantic Time")),
        standard: Some(("AST", "Atlantic Standard Time")),
        daylight: Some(("ADT", "Atlantic Daylight Time")),
        fixed: None,
    },
    // Alaska
    AbbrevFamilyDef {
        zones: &["America/Anchorage", "America/Juneau"],
        generic: Some(("AKT", "Alaska Time")),
        standard: Some(("AKST", "Alaska Standard Time")),
        daylight: Some(("AKDT", "Alaska Daylight Time")),
        fixed: None,
    },
    // Hawaii
    AbbrevFamilyDef {
        zones: &["Pacific/Honolulu"],
        generic: Some(("HT", "Hawaii Time")),
        standard: None,
        daylight: None,
        fixed: Some(("HST", "Hawaii Standard Time")),
    },
    // Western European (UK / Ireland)
    AbbrevFamilyDef {
        zones: &["Europe/London"],
        generic: Some(("WET", "Western European Time")),
        standard: Some(("GMT", "Greenwich Mean Time")),
        daylight: Some(("BST", "British Summer Time")),
        fixed: None,
    },
    AbbrevFamilyDef {
        zones: &["Europe/Dublin"],
        generic: Some(("WET", "Western European Time")),
        standard: Some(("GMT", "Greenwich Mean Time")),
        daylight: Some(("IST", "Irish Standard Time")),
        fixed: None,
    },
    // Portugal / Canary
    AbbrevFamilyDef {
        zones: &["Europe/Lisbon", "Atlantic/Canary", "Atlantic/Madeira"],
        generic: Some(("WET", "Western European Time")),
        standard: Some(("WET", "Western European Time")),
        daylight: Some(("WEST", "Western European Summer Time")),
        fixed: None,
    },
    // Central European
    AbbrevFamilyDef {
        zones: &[
            "Europe/Rome",
            "Europe/Berlin",
            "Europe/Paris",
            "Europe/Madrid",
            "Europe/Amsterdam",
            "Europe/Brussels",
            "Europe/Vienna",
            "Europe/Warsaw",
            "Europe/Prague",
            "Europe/Stockholm",
            "Europe/Oslo",
            "Europe/Copenhagen",
            "Europe/Zurich",
            "Europe/Budapest",
            "Europe/Belgrade",
            "Europe/Bratislava",
            "Europe/Ljubljana",
            "Europe/Zagreb",
            "Europe/Sarajevo",
            "Europe/Skopje",
            "Europe/Tirane",
            "Europe/Luxembourg",
            "Europe/Monaco",
            "Europe/Malta",
            "Europe/Andorra",
            "Europe/San_Marino",
            "Europe/Vatican",
            "Europe/Busingen",
            "Africa/Ceuta",
        ],
        generic: Some(("CET/CEST", "Central European Time")),
        standard: Some(("CET", "Central European Time")),
        daylight: Some(("CEST", "Central European Summer Time")),
        fixed: None,
    },
    // Eastern European
    AbbrevFamilyDef {
        zones: &[
            "Europe/Athens",
            "Europe/Bucharest",
            "Europe/Helsinki",
            "Europe/Kyiv",
            "Europe/Sofia",
            "Europe/Tallinn",
            "Europe/Riga",
            "Europe/Vilnius",
            "Europe/Chisinau",
            "Asia/Beirut",
            "Asia/Gaza",
            "Asia/Hebron",
        ],
        generic: Some(("EET/EEST", "Eastern European Time")),
        standard: Some(("EET", "Eastern European Time")),
        daylight: Some(("EEST", "Eastern European Summer Time")),
        fixed: None,
    },
    // Japan
    AbbrevFamilyDef {
        zones: &["Asia/Tokyo"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("JST", "Japan Standard Time")),
    },
    // India
    AbbrevFamilyDef {
        zones: &["Asia/Kolkata", "Asia/Calcutta"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("IST", "India Standard Time")),
    },
    // China
    AbbrevFamilyDef {
        zones: &["Asia/Shanghai", "Asia/Chongqing", "Asia/Urumqi", "Asia/Harbin"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("CST", "China Standard Time")),
    },
    // Hong Kong
    AbbrevFamilyDef {
        zones: &["Asia/Hong_Kong"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("HKT", "Hong Kong Time")),
    },
    // Singapore
    AbbrevFamilyDef {
        zones: &["Asia/Singapore"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("SGT", "Singapore Time")),
    },
    // Korea
    AbbrevFamilyDef {
        zones: &["Asia/Seoul", "Asia/Pyongyang"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("KST", "Korea Standard Time")),
    },
    // Israel
    AbbrevFamilyDef {
        zones: &["Asia/Jerusalem", "Asia/Tel_Aviv"],
        generic: None,
        standard: Some(("IST", "Israel Standard Time")),
        daylight: Some(("IDT", "Israel Daylight Time")),
        fixed: None,
    },
    // Australian Eastern
    AbbrevFamilyDef {
        zones: &["Australia/Sydney", "Australia/Melbourne", "Australia/Hobart", "Australia/Canberra"],
        generic: Some(("AET", "Australian Eastern Time")),
        standard: Some(("AEST", "Australian Eastern Standard Time")),
        daylight: Some(("AEDT", "Australian Eastern Daylight Time")),
        fixed: None,
    },
    // Queensland (No DST)
    AbbrevFamilyDef {
        zones: &["Australia/Brisbane"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("AEST", "Australian Eastern Standard Time")),
    },
    // Australian Central (with DST)
    AbbrevFamilyDef {
        zones: &["Australia/Adelaide"],
        generic: Some(("ACT", "Australian Central Time")),
        standard: Some(("ACST", "Australian Central Standard Time")),
        daylight: Some(("ACDT", "Australian Central Daylight Time")),
        fixed: None,
    },
    // Northern Territory (No DST)
    AbbrevFamilyDef {
        zones: &["Australia/Darwin"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("ACST", "Australian Central Standard Time")),
    },
    // Australian Western
    AbbrevFamilyDef {
        zones: &["Australia/Perth"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("AWST", "Australian Western Standard Time")),
    },
    // New Zealand
    AbbrevFamilyDef {
        zones: &["Pacific/Auckland"],
        generic: Some(("NZT", "New Zealand Time")),
        standard: Some(("NZST", "New Zealand Standard Time")),
        daylight: Some(("NZDT", "New Zealand Daylight Time")),
        fixed: None,
    },
    // Brazil / Brasilia
    AbbrevFamilyDef {
        zones: &["America/Sao_Paulo", "America/Bahia", "America/Recife", "America/Belem", "America/Fortaleza"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("BRT", "Brasília Time")),
    },
    // Argentina
    AbbrevFamilyDef {
        zones: &["America/Argentina/Buenos_Aires", "America/Argentina/Cordoba"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("ART", "Argentina Time")),
    },
    // Moscow
    AbbrevFamilyDef {
        zones: &["Europe/Moscow", "Europe/Simferopol"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("MSK", "Moscow Standard Time")),
    },
    // Gulf
    AbbrevFamilyDef {
        zones: &["Asia/Dubai", "Asia/Muscat"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("GST", "Gulf Standard Time")),
    },
    // UTC
    AbbrevFamilyDef {
        zones: &["UTC", "Etc/UTC", "Etc/GMT", "GMT", "Etc/Universal", "Etc/Zulu"],
        generic: None,
        standard: None,
        daylight: None,
        fixed: Some(("UTC", "Coordinated Universal Time")),
    },
];

/// Returns all abbreviation badges for a given zone and current DST status
pub fn get_abbreviations_for_zone(iana_id: &str, is_dst: bool) -> Vec<AbbreviationBadge> {
    let mut badges = Vec::new();

    // Look up in definitions
    for def in ABBREV_FAMILIES {
        if def.zones.iter().any(|&z| z.eq_ignore_ascii_case(iana_id)) {
            // 1. Generic year-round badge if defined
            if let Some((code, full_name)) = def.generic {
                badges.push(AbbreviationBadge {
                    code: code.to_string(),
                    full_name: full_name.to_string(),
                    kind: AbbrevKind::GenericYearRound.as_str().to_string(),
                    is_currently_active: true,
                    is_year_round: true,
                });
            }

            // 2. Fixed year-round if defined
            if let Some((code, full_name)) = def.fixed {
                badges.push(AbbreviationBadge {
                    code: code.to_string(),
                    full_name: full_name.to_string(),
                    kind: AbbrevKind::FixedYearRound.as_str().to_string(),
                    is_currently_active: true,
                    is_year_round: true,
                });
            }

            // 3. Standard seasonal
            if let Some((code, full_name)) = def.standard {
                badges.push(AbbreviationBadge {
                    code: code.to_string(),
                    full_name: full_name.to_string(),
                    kind: AbbrevKind::StandardSeasonal.as_str().to_string(),
                    is_currently_active: !is_dst,
                    is_year_round: false,
                });
            }

            // 4. Daylight seasonal
            if let Some((code, full_name)) = def.daylight {
                badges.push(AbbreviationBadge {
                    code: code.to_string(),
                    full_name: full_name.to_string(),
                    kind: AbbrevKind::DaylightSeasonal.as_str().to_string(),
                    is_currently_active: is_dst,
                    is_year_round: false,
                });
            }

            return badges;
        }
    }

    // Default fallback: parse abbreviation from IANA zone name
    let fallback_code = iana_id.split('/').last().unwrap_or(iana_id);
    badges.push(AbbreviationBadge {
        code: fallback_code.to_string(),
        full_name: iana_id.to_string(),
        kind: if is_dst {
            AbbrevKind::DaylightSeasonal.as_str().to_string()
        } else {
            AbbrevKind::FixedYearRound.as_str().to_string()
        },
        is_currently_active: true,
        is_year_round: !is_dst,
    });

    badges
}

/// Disambiguation target for ambiguous abbreviations
pub struct DisambiguatedAbbrev {
    pub code: &'static str,
    pub full_name: &'static str,
    pub primary_iana: &'static str,
    pub offset_hours: f32,
    pub kind: AbbrevKind,
}

pub const AMBIGUOUS_ABBREVIATIONS: &[(&str, &[DisambiguatedAbbrev])] = &[
    (
        "IST",
        &[
            DisambiguatedAbbrev {
                code: "IST",
                full_name: "India Standard Time",
                primary_iana: "Asia/Kolkata",
                offset_hours: 5.5,
                kind: AbbrevKind::FixedYearRound,
            },
            DisambiguatedAbbrev {
                code: "IST",
                full_name: "Irish Standard Time",
                primary_iana: "Europe/Dublin",
                offset_hours: 1.0,
                kind: AbbrevKind::DaylightSeasonal,
            },
            DisambiguatedAbbrev {
                code: "IST",
                full_name: "Israel Standard Time",
                primary_iana: "Asia/Jerusalem",
                offset_hours: 2.0,
                kind: AbbrevKind::StandardSeasonal,
            },
        ],
    ),
    (
        "CST",
        &[
            DisambiguatedAbbrev {
                code: "CST",
                full_name: "Central Standard Time (North America)",
                primary_iana: "America/Chicago",
                offset_hours: -6.0,
                kind: AbbrevKind::StandardSeasonal,
            },
            DisambiguatedAbbrev {
                code: "CST",
                full_name: "China Standard Time",
                primary_iana: "Asia/Shanghai",
                offset_hours: 8.0,
                kind: AbbrevKind::FixedYearRound,
            },
            DisambiguatedAbbrev {
                code: "CST",
                full_name: "Cuba Standard Time",
                primary_iana: "America/Havana",
                offset_hours: -5.0,
                kind: AbbrevKind::StandardSeasonal,
            },
        ],
    ),
    (
        "BST",
        &[
            DisambiguatedAbbrev {
                code: "BST",
                full_name: "British Summer Time",
                primary_iana: "Europe/London",
                offset_hours: 1.0,
                kind: AbbrevKind::DaylightSeasonal,
            },
            DisambiguatedAbbrev {
                code: "BST",
                full_name: "Bangladesh Standard Time",
                primary_iana: "Asia/Dhaka",
                offset_hours: 6.0,
                kind: AbbrevKind::FixedYearRound,
            },
        ],
    ),
    (
        "PST",
        &[
            DisambiguatedAbbrev {
                code: "PST",
                full_name: "Pacific Standard Time (North America)",
                primary_iana: "America/Los_Angeles",
                offset_hours: -8.0,
                kind: AbbrevKind::StandardSeasonal,
            },
            DisambiguatedAbbrev {
                code: "PST",
                full_name: "Pakistan Standard Time",
                primary_iana: "Asia/Karachi",
                offset_hours: 5.0,
                kind: AbbrevKind::FixedYearRound,
            },
        ],
    ),
    (
        "AST",
        &[
            DisambiguatedAbbrev {
                code: "AST",
                full_name: "Atlantic Standard Time (North America)",
                primary_iana: "America/Halifax",
                offset_hours: -4.0,
                kind: AbbrevKind::StandardSeasonal,
            },
            DisambiguatedAbbrev {
                code: "AST",
                full_name: "Arabia Standard Time",
                primary_iana: "Asia/Riyadh",
                offset_hours: 3.0,
                kind: AbbrevKind::FixedYearRound,
            },
        ],
    ),
    (
        "ACT",
        &[
            DisambiguatedAbbrev {
                code: "ACT",
                full_name: "Australian Central Time",
                primary_iana: "Australia/Adelaide",
                offset_hours: 9.5,
                kind: AbbrevKind::GenericYearRound,
            },
            DisambiguatedAbbrev {
                code: "ACT",
                full_name: "Acre Time",
                primary_iana: "America/Rio_Branco",
                offset_hours: -5.0,
                kind: AbbrevKind::FixedYearRound,
            },
        ],
    ),
];

pub fn get_disambiguations_for_abbrev(abbr: &str) -> Option<&'static [DisambiguatedAbbrev]> {
    for (code, defs) in AMBIGUOUS_ABBREVIATIONS {
        if code.eq_ignore_ascii_case(abbr) {
            return Some(defs);
        }
    }
    None
}

/// Country knowledge base: Country name, aliases, and primary IANA zones
pub struct CountryInfo {
    pub name: &'static str,
    pub aliases: &'static [&'static str],
    pub primary_zones: &'static [&'static str],
}

pub const COUNTRIES: &[CountryInfo] = &[
    CountryInfo {
        name: "Italy",
        aliases: &["IT", "ITA", "Italia", "Italian Republic"],
        primary_zones: &["Europe/Rome"],
    },
    CountryInfo {
        name: "United States",
        aliases: &["US", "USA", "America", "United States of America"],
        primary_zones: &[
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Anchorage",
            "Pacific/Honolulu",
            "America/Phoenix",
        ],
    },
    CountryInfo {
        name: "United Kingdom",
        aliases: &["UK", "GB", "GBR", "Britain", "Great Britain", "England", "Scotland", "Wales"],
        primary_zones: &["Europe/London"],
    },
    CountryInfo {
        name: "Germany",
        aliases: &["DE", "DEU", "Deutschland"],
        primary_zones: &["Europe/Berlin"],
    },
    CountryInfo {
        name: "France",
        aliases: &["FR", "FRA", "French Republic"],
        primary_zones: &["Europe/Paris"],
    },
    CountryInfo {
        name: "Spain",
        aliases: &["ES", "ESP", "España"],
        primary_zones: &["Europe/Madrid", "Atlantic/Canary"],
    },
    CountryInfo {
        name: "Japan",
        aliases: &["JP", "JPN", "Nippon", "Nihon"],
        primary_zones: &["Asia/Tokyo"],
    },
    CountryInfo {
        name: "India",
        aliases: &["IN", "IND", "Bharat"],
        primary_zones: &["Asia/Kolkata"],
    },
    CountryInfo {
        name: "China",
        aliases: &["CN", "CHN", "PRC"],
        primary_zones: &["Asia/Shanghai"],
    },
    CountryInfo {
        name: "Brazil",
        aliases: &["BR", "BRA", "Brasil"],
        primary_zones: &["America/Sao_Paulo", "America/Manaus", "America/Fortaleza"],
    },
    CountryInfo {
        name: "Australia",
        aliases: &["AU", "AUS"],
        primary_zones: &[
            "Australia/Sydney",
            "Australia/Melbourne",
            "Australia/Brisbane",
            "Australia/Perth",
            "Australia/Adelaide",
            "Australia/Darwin",
            "Australia/Hobart",
        ],
    },
    CountryInfo {
        name: "Canada",
        aliases: &["CA", "CAN"],
        primary_zones: &[
            "America/Toronto",
            "America/Vancouver",
            "America/Montreal",
            "America/Edmonton",
            "America/Winnipeg",
            "America/Halifax",
            "America/St_Johns",
        ],
    },
    CountryInfo {
        name: "Mexico",
        aliases: &["MX", "MEX"],
        primary_zones: &["America/Mexico_City", "America/Cancun", "America/Tijuana"],
    },
    CountryInfo {
        name: "Netherlands",
        aliases: &["NL", "NLD", "Holland"],
        primary_zones: &["Europe/Amsterdam"],
    },
    CountryInfo {
        name: "Switzerland",
        aliases: &["CH", "CHE", "Schweiz", "Suisse", "Svizzera"],
        primary_zones: &["Europe/Zurich"],
    },
    CountryInfo {
        name: "Sweden",
        aliases: &["SE", "SWE", "Sverige"],
        primary_zones: &["Europe/Stockholm"],
    },
    CountryInfo {
        name: "Norway",
        aliases: &["NO", "NOR", "Norge"],
        primary_zones: &["Europe/Oslo"],
    },
    CountryInfo {
        name: "Denmark",
        aliases: &["DK", "DNK", "Danmark"],
        primary_zones: &["Europe/Copenhagen"],
    },
    CountryInfo {
        name: "Finland",
        aliases: &["FI", "FIN", "Suomi"],
        primary_zones: &["Europe/Helsinki"],
    },
    CountryInfo {
        name: "Ireland",
        aliases: &["IE", "IRL", "Eire"],
        primary_zones: &["Europe/Dublin"],
    },
    CountryInfo {
        name: "Portugal",
        aliases: &["PT", "PRT"],
        primary_zones: &["Europe/Lisbon", "Atlantic/Azores", "Atlantic/Madeira"],
    },
    CountryInfo {
        name: "Greece",
        aliases: &["GR", "GRC", "Hellas"],
        primary_zones: &["Europe/Athens"],
    },
    CountryInfo {
        name: "Poland",
        aliases: &["PL", "POL", "Polska"],
        primary_zones: &["Europe/Warsaw"],
    },
    CountryInfo {
        name: "Austria",
        aliases: &["AT", "AUT", "Österreich"],
        primary_zones: &["Europe/Vienna"],
    },
    CountryInfo {
        name: "Belgium",
        aliases: &["BE", "BEL", "Belgique", "België"],
        primary_zones: &["Europe/Brussels"],
    },
    CountryInfo {
        name: "Czechia",
        aliases: &["CZ", "CZE", "Czech Republic", "Česko"],
        primary_zones: &["Europe/Prague"],
    },
    CountryInfo {
        name: "Hungary",
        aliases: &["HU", "HUN", "Magyarország"],
        primary_zones: &["Europe/Budapest"],
    },
    CountryInfo {
        name: "Ukraine",
        aliases: &["UA", "UKR"],
        primary_zones: &["Europe/Kyiv"],
    },
    CountryInfo {
        name: "Russia",
        aliases: &["RU", "RUS"],
        primary_zones: &["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Vladivostok"],
    },
    CountryInfo {
        name: "Turkey",
        aliases: &["TR", "TUR", "Türkiye"],
        primary_zones: &["Europe/Istanbul"],
    },
    CountryInfo {
        name: "South Korea",
        aliases: &["KR", "KOR", "Korea"],
        primary_zones: &["Asia/Seoul"],
    },
    CountryInfo {
        name: "Singapore",
        aliases: &["SG", "SGP"],
        primary_zones: &["Asia/Singapore"],
    },
    CountryInfo {
        name: "New Zealand",
        aliases: &["NZ", "NZL"],
        primary_zones: &["Pacific/Auckland"],
    },
    CountryInfo {
        name: "Argentina",
        aliases: &["AR", "ARG"],
        primary_zones: &["America/Argentina/Buenos_Aires"],
    },
    CountryInfo {
        name: "Chile",
        aliases: &["CL", "CHL"],
        primary_zones: &["America/Santiago"],
    },
    CountryInfo {
        name: "South Africa",
        aliases: &["ZA", "ZAF"],
        primary_zones: &["Africa/Johannesburg"],
    },
    CountryInfo {
        name: "Egypt",
        aliases: &["EG", "EGY"],
        primary_zones: &["Africa/Cairo"],
    },
    CountryInfo {
        name: "United Arab Emirates",
        aliases: &["AE", "ARE", "UAE", "Dubai", "Abu Dhabi"],
        primary_zones: &["Asia/Dubai"],
    },
    CountryInfo {
        name: "Saudi Arabia",
        aliases: &["SA", "SAU", "KSA"],
        primary_zones: &["Asia/Riyadh"],
    },
    CountryInfo {
        name: "Israel",
        aliases: &["IL", "ISR"],
        primary_zones: &["Asia/Jerusalem"],
    },
    CountryInfo {
        name: "Indonesia",
        aliases: &["ID", "IDN"],
        primary_zones: &["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
    },
    CountryInfo {
        name: "Thailand",
        aliases: &["TH", "THA"],
        primary_zones: &["Asia/Bangkok"],
    },
    CountryInfo {
        name: "Vietnam",
        aliases: &["VN", "VNM"],
        primary_zones: &["Asia/Ho_Chi_Minh"],
    },
    CountryInfo {
        name: "Philippines",
        aliases: &["PH", "PHL"],
        primary_zones: &["Asia/Manila"],
    },
    CountryInfo {
        name: "Malaysia",
        aliases: &["MY", "MYS"],
        primary_zones: &["Asia/Kuala_Lumpur"],
    },
    CountryInfo {
        name: "Iceland",
        aliases: &["IS", "ISL"],
        primary_zones: &["Atlantic/Reykjavik"],
    },
];

/// Finds countries matching query string
pub fn find_countries_by_query(query: &str) -> Vec<&'static CountryInfo> {
    let q = query.trim();
    if q.is_empty() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    for country in COUNTRIES {
        if country.name.eq_ignore_ascii_case(q)
            || country.aliases.iter().any(|&a| a.eq_ignore_ascii_case(q))
            || country.name.to_lowercase().contains(&q.to_lowercase())
        {
            matches.push(country);
        }
    }
    matches
}

/// Finds countries associated with a given IANA timezone ID
pub fn find_countries_for_zone(iana_id: &str) -> Vec<String> {
    let mut names = Vec::new();
    for country in COUNTRIES {
        if country.primary_zones.iter().any(|&z| z.eq_ignore_ascii_case(iana_id)) {
            names.push(country.name.to_string());
        }
    }
    names
}
