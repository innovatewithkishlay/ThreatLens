const DEFAULTS = require("../../config/thresholds");

// Settings investigators may tune per case: [path, min, max, integer?]
const TUNABLE = [
  ["HIGH_VALUE", 1, 1e12],
  ["REPORTING_THRESHOLD", 1, 1e12],
  ["STRUCTURING_BAND", 0.01, 0.5],
  ["STRUCTURING_MIN_COUNT", 1, 1000, true],
  ["RAPID_SUCCESSIVE.count", 2, 1000, true],
  ["RAPID_SUCCESSIVE.minutes", 1, 1440, true],
  ["SMURFING.minCounterparties", 2, 1000, true],
  ["SMURFING.windowHours", 1, 720, true],
  ["PASS_THROUGH.windowHours", 0.1, 720],
  ["PASS_THROUGH.minRatio", 0.1, 1],
  ["PASS_THROUGH.minAmount", 0, 1e12],
  ["CIRCULAR.minAmount", 0, 1e12],
  ["CIRCULAR.windowDays", 1, 365, true],
  ["FREQUENT_PAIR_COUNT", 1, 10000, true],
  ["NEW_ACCOUNT_DAYS", 1, 3650, true],
  ["NEW_ACCOUNT_HIGH_VALUE", 0, 1e12],
  ["DORMANT.days", 1, 3650, true],
  ["DORMANT.minAmount", 0, 1e12],
  ["OUTLIER.multiple", 2, 1000],
  ["OUTLIER.minAmount", 0, 1e12],
];

const clone = (o) => JSON.parse(JSON.stringify(o));
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
const setPath = (o, p, v) => {
  const keys = p.split(".");
  const last = keys.pop();
  keys.reduce((x, k) => (x[k] = x[k] || {}), o)[last] = v;
};

/** Merge user-supplied overrides onto the defaults, validating every value. */
const resolveThresholds = (overrides) => {
  const t = clone(DEFAULTS);
  if (!overrides || typeof overrides !== "object") return t;
  for (const [path, min, max, int] of TUNABLE) {
    const raw = getPath(overrides, path);
    if (raw === undefined || raw === null || raw === "") continue;
    let n = Number(raw);
    if (!Number.isFinite(n)) continue;
    n = Math.min(max, Math.max(min, int ? Math.round(n) : n));
    setPath(t, path, n);
  }
  if (Array.isArray(overrides.UNUSUAL_HOURS) && overrides.UNUSUAL_HOURS.length === 2) {
    const [a, b] = overrides.UNUSUAL_HOURS.map((x) => Math.min(23, Math.max(0, Math.round(Number(x)))));
    if (Number.isFinite(a) && Number.isFinite(b) && a <= b) t.UNUSUAL_HOURS = [a, b];
  }
  if (Array.isArray(overrides.HIGH_RISK_COUNTRIES)) {
    t.HIGH_RISK_COUNTRIES = [...new Set(overrides.HIGH_RISK_COUNTRIES.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))];
  }
  return t;
};

/** Only the values that differ from the defaults (what we store on the case). */
const diffFromDefaults = (t) => {
  const out = {};
  for (const [path] of TUNABLE) {
    if (getPath(t, path) !== getPath(DEFAULTS, path)) setPath(out, path, getPath(t, path));
  }
  if (t.UNUSUAL_HOURS.join() !== DEFAULTS.UNUSUAL_HOURS.join()) out.UNUSUAL_HOURS = t.UNUSUAL_HOURS;
  if ([...t.HIGH_RISK_COUNTRIES].sort().join() !== [...DEFAULTS.HIGH_RISK_COUNTRIES].sort().join()) out.HIGH_RISK_COUNTRIES = t.HIGH_RISK_COUNTRIES;
  return Object.keys(out).length ? out : null;
};

module.exports = { resolveThresholds, diffFromDefaults, DEFAULTS, TUNABLE };
