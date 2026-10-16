// Watchlist screening helpers.

const normaliseName = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|ltd|llc|inc|plc|co|corp|limited|the)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normaliseValue = (type, v) => {
  const s = String(v || "").trim();
  if (type === "email") return s.toLowerCase();
  if (type === "phone") return s.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (type === "account") return s.toUpperCase().replace(/\s+/g, "");
  if (type === "name") return normaliseName(s);
  return s.toLowerCase();
};

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

/**
 * Similarity between two person / company names in [0, 1]. Token order is
 * ignored ("Doe John" == "John Doe") and small typos are tolerated.
 */
const nameSimilarity = (a, b) => {
  const ta = normaliseName(a).split(" ").filter(Boolean).sort();
  const tb = normaliseName(b).split(" ").filter(Boolean).sort();
  if (!ta.length || !tb.length) return 0;
  const sa = ta.join(" ");
  const sb = tb.join(" ");
  if (sa === sb) return 1;
  const whole = 1 - levenshtein(sa, sb) / Math.max(sa.length, sb.length);
  // Token-level best matches handle middle names and initials.
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const tokenScores = short.map((t) =>
    Math.max(...long.map((u) => (t.length === 1 || u.length === 1 ? (t[0] === u[0] ? 0.9 : 0) : 1 - levenshtein(t, u) / Math.max(t.length, u.length))))
  );
  const tokens = tokenScores.reduce((s, x) => s + x, 0) / short.length;
  const coverage = short.length / long.length;
  return Math.max(whole, tokens * (0.75 + 0.25 * coverage));
};

const NAME_MATCH_THRESHOLD = 0.85;

/**
 * Screen accounts against watchlist entries.
 * @returns {Array<{entry, account, field, value, score}>}
 */
const screenAccounts = (accounts, watchlist = []) => {
  const hits = [];
  if (!watchlist.length) return hits;
  const byType = (type) => watchlist.filter((w) => w.type === type);
  const exact = {
    account: new Map(byType("account").map((w) => [normaliseValue("account", w.value), w])),
    email: new Map(byType("email").map((w) => [normaliseValue("email", w.value), w])),
    phone: new Map(byType("phone").map((w) => [normaliseValue("phone", w.value), w])),
    ip: new Map(byType("ip").map((w) => [normaliseValue("ip", w.value), w])),
  };
  const names = byType("name");

  for (const a of accounts) {
    const checks = [
      ["account", "account", a.accountNumber],
      ["email", "email", a.metadata?.email],
      ["phone", "mobile", a.metadata?.mobile],
      ["ip", "ipAddress", a.metadata?.ipAddress],
    ];
    for (const [type, field, value] of checks) {
      if (!value) continue;
      const w = exact[type].get(normaliseValue(type, value));
      if (w) hits.push({ entry: w, account: a.accountNumber, field, value, score: 1 });
    }
    if (a.accountHolder && names.length) {
      for (const w of names) {
        const score = nameSimilarity(a.accountHolder, w.value);
        if (score >= NAME_MATCH_THRESHOLD) {
          hits.push({ entry: w, account: a.accountNumber, field: "accountHolder", value: a.accountHolder, score: Math.round(score * 100) / 100 });
        }
      }
    }
  }
  return hits;
};

module.exports = { screenAccounts, nameSimilarity, normaliseValue, normaliseName, NAME_MATCH_THRESHOLD };
