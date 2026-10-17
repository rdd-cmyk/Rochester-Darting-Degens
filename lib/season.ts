export type Season = "spring" | "summer" | "fall" | "winter";

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter",
};

// Eastern calendar days of the March/June/September/December equinoxes/solstices.
// Source: https://aa.usno.navy.mil/api/seasons?year=2026 (and each listed year).
// Retrieved 2026-10-17. Keeping dates local avoids a network dependency at runtime.
const START_DAYS: Record<number, readonly number[]> = {
  2025: [20, 20, 22, 21],
  2026: [20, 21, 22, 21],
  2027: [20, 21, 23, 21],
  2028: [19, 20, 22, 21],
  2029: [20, 20, 22, 21],
  2030: [20, 21, 22, 21],
  2031: [20, 21, 23, 21],
  2032: [19, 20, 22, 21],
  2033: [20, 20, 22, 21],
  2034: [20, 21, 22, 21],
  2035: [20, 21, 23, 21],
  2036: [19, 20, 22, 21],
  2037: [20, 20, 22, 21],
  2038: [20, 21, 22, 21],
  2039: [20, 21, 22, 21],
  2040: [19, 20, 22, 21],
  2041: [20, 20, 22, 21],
  2042: [20, 21, 22, 21],
  2043: [20, 21, 22, 21],
  2044: [19, 20, 22, 21],
  2045: [20, 20, 22, 21],
  2046: [20, 21, 22, 21],
  2047: [20, 21, 22, 21],
  2048: [19, 20, 22, 21],
  2049: [20, 20, 22, 21],
  2050: [20, 20, 22, 21],
  2051: [20, 21, 22, 21],
  2052: [19, 20, 22, 20],
  2053: [19, 20, 22, 21],
  2054: [20, 20, 22, 21],
  2055: [20, 21, 22, 21],
  2056: [19, 20, 22, 20],
  2057: [19, 20, 22, 21],
  2058: [20, 20, 22, 21],
  2059: [20, 21, 22, 21],
  2060: [19, 20, 22, 20],
  2061: [19, 20, 22, 21],
  2062: [20, 20, 22, 21],
  2063: [20, 21, 22, 21],
  2064: [19, 20, 22, 20],
  2065: [19, 20, 22, 21],
  2066: [20, 20, 22, 21],
  2067: [20, 21, 22, 21],
  2068: [19, 20, 22, 20],
  2069: [19, 20, 22, 21],
  2070: [20, 20, 22, 21],
  2071: [20, 21, 22, 21],
  2072: [19, 20, 21, 20],
  2073: [19, 20, 22, 21],
  2074: [20, 20, 22, 21],
  2075: [20, 21, 22, 21],
  2076: [19, 20, 21, 20],
  2077: [19, 20, 22, 21],
  2078: [20, 20, 22, 21],
  2079: [20, 20, 22, 21],
  2080: [19, 20, 21, 20],
  2081: [19, 20, 22, 21],
  2082: [20, 20, 22, 21],
  2083: [20, 20, 22, 21],
  2084: [19, 20, 21, 20],
  2085: [19, 20, 22, 20],
  2086: [19, 20, 22, 21],
  2087: [20, 20, 22, 21],
  2088: [19, 20, 21, 20],
  2089: [19, 20, 22, 20],
  2090: [19, 20, 22, 21],
  2091: [20, 20, 22, 21],
  2092: [19, 20, 21, 20],
  2093: [19, 20, 22, 20],
  2094: [19, 20, 22, 21],
  2095: [20, 20, 22, 21],
  2096: [19, 20, 21, 20],
  2097: [19, 20, 22, 20],
  2098: [19, 20, 22, 21],
  2099: [20, 20, 22, 21],
  2100: [20, 21, 22, 21],
};
const easternDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric",
});

export function getSeason(date = new Date()): Season {
  const parts = easternDate.formatToParts(date);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const year = part("year"), month = part("month"), day = part("day");
  // Conventional calendar dates outside the published 2025–2100 table.
  const [spring, summer, fall, winter] = START_DAYS[year] ?? [20, 21, 22, 21];
  const today = month * 100 + day;
  if (today >= 1200 + winter || today < 300 + spring) return "winter";
  if (today >= 900 + fall) return "fall";
  if (today >= 600 + summer) return "summer";
  return "spring";
}
