use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BaseZoneExpr {
    Local,
    Utc,
    Gmt,
    Iana(String),          // e.g., "Europe/Rome"
    Abbreviation(String),  // e.g., "CET", "CEST", "PT", "PST", "PDT", "IST"
    LocationQuery(String), // e.g., "Italy", "Rome", "Tokyo"
    FixedOffsetSeconds(i32),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OffsetDelta {
    pub sign: i8, // +1 or -1
    pub hours: i32,
    pub minutes: i32,
    pub seconds: i32,
}

impl OffsetDelta {
    pub fn new(sign: i8, hours: i32, minutes: i32, seconds: i32) -> Self {
        Self {
            sign,
            hours,
            minutes,
            seconds,
        }
    }

    pub fn from_hours(hours: i32) -> Self {
        let sign = if hours < 0 { -1 } else { 1 };
        Self {
            sign,
            hours: hours.abs(),
            minutes: 0,
            seconds: 0,
        }
    }

    pub fn total_seconds(&self) -> i32 {
        (self.sign as i32) * (self.hours * 3600 + self.minutes * 60 + self.seconds)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TimeQueryAst {
    /// Simple or compound zone expression: e.g., `Local+3`, `Europe/Rome + 5:30`, `Italy`, `PST`
    ZoneWithOffset {
        base: BaseZoneExpr,
        deltas: Vec<OffsetDelta>,
        at_time: Option<FlexibleDateTimeAst>,
    },
    /// Pure offset expression: e.g., `+02:00`, `-5`, `UTC+5:30`, `GMT-8`
    PureOffset {
        total_seconds: i32,
        at_time: Option<FlexibleDateTimeAst>,
    },
    /// Fuzzy search fallback / partial token
    FuzzySearch(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FlexibleDateTimeAst {
    pub date: Option<(i16, i8, i8)>, // YYYY-MM-DD, DD/MM/YYYY, or MonthName Day, Year
    pub time: Option<(i8, i8, i8)>,  // 24h or 12h AM/PM
    pub unix_timestamp: Option<i64>, // @1730000000
}

impl FlexibleDateTimeAst {
    pub fn empty() -> Self {
        Self {
            date: None,
            time: None,
            unix_timestamp: None,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.date.is_none() && self.time.is_none() && self.unix_timestamp.is_none()
    }
}
