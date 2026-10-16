// Detection thresholds. Tune these to match your institution's risk appetite.
module.exports = {
  // Single transactions at or above this amount are flagged as high value.
  HIGH_VALUE: 50000,

  // Currency transaction reporting threshold used for structuring checks.
  REPORTING_THRESHOLD: 10000,
  // Amounts within this fraction below the threshold count as "near threshold".
  STRUCTURING_BAND: 0.1,
  // Minimum near-threshold transactions from one account to raise a finding.
  STRUCTURING_MIN_COUNT: 2,

  // Burst of outgoing transactions from one account.
  RAPID_SUCCESSIVE: { count: 5, minutes: 10 },

  // Fan-in (smurfing) / fan-out (dispersion) detection.
  SMURFING: { minCounterparties: 5, windowHours: 48 },

  // Pass-through: funds received and forwarded within this window.
  PASS_THROUGH: { windowHours: 1, minRatio: 0.8, minAmount: 5000 },

  // Circular flows: money that returns to its origin. Each hop must happen
  // after the previous one, within the window, and carry a similar amount.
  CIRCULAR: { maxLength: 6, maxCycles: 50, windowDays: 30, minAmount: 5000, minRatio: 0.7, maxRatio: 1.05 },

  // Same sender -> receiver pair repeated more than this many times.
  FREQUENT_PAIR_COUNT: 5,

  // Round-number transactions.
  ROUND_AMOUNT: { multiple: 1000, minAmount: 5000, minCount: 3 },

  // Transactions between these hours (inclusive, 24h clock, as recorded).
  UNUSUAL_HOURS: [0, 4],

  // Accounts opened recently that move large sums.
  NEW_ACCOUNT_DAYS: 30,
  NEW_ACCOUNT_HIGH_VALUE: 20000,

  // ISO 3166-1 alpha-2 codes of high-risk / monitored jurisdictions
  // (based on the FATF "black" and "grey" lists - review regularly).
  HIGH_RISK_COUNTRIES: [
    "KP", "IR", "MM", "DZ", "AO", "BG", "BO", "CM", "CI", "CD", "HT", "KE",
    "LA", "LB", "MC", "MZ", "NA", "NP", "NG", "SS", "SY", "VE", "VN", "YE",
    "VG",
  ],
};
