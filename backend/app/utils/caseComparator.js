const DEFAULT_THRESHOLDS = require("../../config/thresholds");

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

const cosine = (a, b) => {
  const len = Math.max(a.length, b.length);
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    ma += x * x;
    mb += y * y;
  }
  return ma && mb ? dot / Math.sqrt(ma * mb) : 0;
};

// Log-scale amount histogram: [<100, <1k, <10k, <100k, <1M, >=1M]
const amountHistogram = (txs) => {
  const bins = Array(6).fill(0);
  for (const t of txs) {
    const idx = Math.min(5, Math.max(0, Math.floor(Math.log10(Math.max(t.amount, 1))) - 1));
    bins[idx]++;
  }
  return bins;
};

const hourHistogram = (txs) => {
  const bins = Array(24).fill(0);
  for (const t of txs) if (t.date) bins[new Date(t.date).getUTCHours()]++;
  return bins;
};

const typeVector = (analysis, types) => types.map((t) => analysis?.summary?.byType?.[t] || 0);

const dateRange = (txs) => {
  const times = txs.filter((t) => t.date).map((t) => new Date(t.date).getTime());
  if (!times.length) return null;
  return { start: Math.min(...times), end: Math.max(...times) };
};

const DAY = 24 * 3600 * 1000;
const FLOW_WINDOW_MS = 7 * DAY;

/**
 * Compare two analysed cases and surface links between them.
 * Each case: { case: {_id, caseId, name, analysis}, accounts: [], transactions: [] }
 */
const compareCases = (a, b, thresholds = DEFAULT_THRESHOLDS) => {
  const highRisk = new Set(thresholds.HIGH_RISK_COUNTRIES);

  const accountSet = (c) => {
    const set = new Set(c.accounts.map((x) => x.accountNumber));
    c.transactions.forEach((t) => {
      set.add(t.fromAccount);
      set.add(t.toAccount);
    });
    return set;
  };
  const setA = accountSet(a);
  const setB = accountSet(b);

  const profile = (c, account) => {
    const sent = c.transactions.filter((t) => t.fromAccount === account);
    const received = c.transactions.filter((t) => t.toAccount === account);
    const risk = c.case.analysis?.accountRisk?.find((r) => r.account === account);
    return {
      sent: sent.length,
      received: received.length,
      outflow: round2(sent.reduce((s, t) => s + t.amount, 0)),
      inflow: round2(received.reduce((s, t) => s + t.amount, 0)),
      score: risk?.score || 0,
      level: risk?.level || "low",
    };
  };

  const sharedAccounts = [...setA]
    .filter((acc) => setB.has(acc))
    .map((account) => ({ account, caseA: profile(a, account), caseB: profile(b, account) }))
    .sort((x, y) => y.caseA.score + y.caseB.score - (x.caseA.score + x.caseB.score));

  // Shared identifiers across *different* or same accounts in both cases
  const identifiers = (c, field) => {
    const map = new Map();
    for (const acc of c.accounts) {
      const v = acc.metadata?.[field];
      if (!v) continue;
      if (!map.has(v)) map.set(v, new Set());
      map.get(v).add(acc.accountNumber);
    }
    return map;
  };
  const sharedIdentifiers = [];
  for (const [field, label] of [["email", "Email"], ["mobile", "Phone"], ["ipAddress", "IP address"]]) {
    const ia = identifiers(a, field);
    const ib = identifiers(b, field);
    for (const [value, accsA] of ia) {
      if (ib.has(value)) {
        // The same account appearing in both cases is already a shared
        // account; only report identifiers that tie *different* accounts.
        const accsB = ib.get(value);
        if ([...accsA].every((x) => accsB.has(x)) && [...accsB].every((x) => accsA.has(x))) continue;
        sharedIdentifiers.push({ field, label, value, accountsA: [...accsA], accountsB: [...ib.get(value)] });
      }
    }
  }

  // Cross-case flows: money arriving at an account in one case that is then
  // moved on in the other case.
  const crossCaseFlows = [];
  const flowsVia = (src, dst, direction) => {
    const outBySender = new Map();
    for (const t of dst.transactions) {
      if (!outBySender.has(t.fromAccount)) outBySender.set(t.fromAccount, []);
      outBySender.get(t.fromAccount).push(t);
    }
    for (const t1 of src.transactions) {
      const onward = outBySender.get(t1.toAccount);
      if (!onward) continue;
      for (const t2 of onward) {
        if (crossCaseFlows.length >= 200) return;
        if (t2.toAccount === t1.fromAccount) continue;
        const gapMs = t1.date && t2.date ? new Date(t2.date) - new Date(t1.date) : null;
        // Money can only move on after it arrives, and only flows within
        // the window are meaningful.
        if (gapMs !== null && (gapMs < 0 || gapMs > FLOW_WINDOW_MS)) continue;
        crossCaseFlows.push({
          direction,
          path: [t1.fromAccount, t1.toAccount, t2.toAccount],
          via: t1.toAccount,
          amountIn: t1.amount,
          amountOut: t2.amount,
          gapHours: gapMs === null ? null : round2(gapMs / 3600000),
          transactions: [String(t1._id), String(t2._id)],
        });
      }
    }
  };
  flowsVia(a, b, "A→B");
  flowsVia(b, a, "B→A");
  // Prefer flows where money moves forward in time quickly.
  crossCaseFlows.sort((x, y) => {
    const gx = x.gapHours === null || x.gapHours < 0 ? Infinity : x.gapHours;
    const gy = y.gapHours === null || y.gapHours < 0 ? Infinity : y.gapHours;
    return gx - gy || y.amountOut - x.amountOut;
  });

  // Pattern similarity
  const types = Object.keys({
    ...(a.case.analysis?.summary?.byType || {}),
    ...(b.case.analysis?.summary?.byType || {}),
  });
  const similarity = {
    typologies: round3(cosine(typeVector(a.case.analysis, types), typeVector(b.case.analysis, types))),
    amounts: round3(cosine(amountHistogram(a.transactions), amountHistogram(b.transactions))),
    timeOfDay: round3(cosine(hourHistogram(a.transactions), hourHistogram(b.transactions))),
  };
  similarity.overall = round3((similarity.typologies + similarity.amounts + similarity.timeOfDay) / 3);

  const commonTypologies = types.filter(
    (t) => a.case.analysis?.summary?.byType?.[t] && b.case.analysis?.summary?.byType?.[t]
  );

  // Temporal overlap
  const ra = dateRange(a.transactions);
  const rb = dateRange(b.transactions);
  let overlap = null;
  if (ra && rb) {
    const start = Math.max(ra.start, rb.start);
    const end = Math.min(ra.end, rb.end);
    if (start <= end) {
      overlap = {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        days: Math.max(1, Math.ceil((end - start) / DAY)),
      };
    }
  }
  const temporal = {
    caseA: ra && { start: new Date(ra.start).toISOString(), end: new Date(ra.end).toISOString() },
    caseB: rb && { start: new Date(rb.start).toISOString(), end: new Date(rb.end).toISOString() },
    overlap,
  };

  // Geography
  const countries = (c) => new Set(c.transactions.map((t) => t.country).filter(Boolean));
  const ca = countries(a);
  const cb = countries(b);
  const commonCountries = [...ca].filter((c) => cb.has(c)).sort();
  const geography = {
    caseA: [...ca].sort(),
    caseB: [...cb].sort(),
    commonCountries,
    commonHighRisk: commonCountries.filter((c) => highRisk.has(c)),
  };

  // Combined network
  const edgeMap = new Map();
  const addEdges = (c, tag) => {
    for (const t of c.transactions) {
      const key = `${t.fromAccount}\u0000${t.toAccount}`;
      const e = edgeMap.get(key) || { from: t.fromAccount, to: t.toAccount, totalAmount: 0, count: 0, cases: new Set() };
      e.totalAmount = round2(e.totalAmount + t.amount);
      e.count++;
      e.cases.add(tag);
      edgeMap.set(key, e);
    }
  };
  addEdges(a, "A");
  addEdges(b, "B");
  const sharedSet = new Set(sharedAccounts.map((s) => s.account));
  const riskOf = (account) =>
    Math.max(
      a.case.analysis?.accountRisk?.find((r) => r.account === account)?.score || 0,
      b.case.analysis?.accountRisk?.find((r) => r.account === account)?.score || 0
    );
  const network = {
    nodes: [...new Set([...setA, ...setB])].map((id) => ({
      id,
      label: id,
      membership: sharedSet.has(id) ? "both" : setA.has(id) ? "A" : "B",
      score: riskOf(id),
    })),
    edges: [...edgeMap.values()].map((e) => ({ ...e, cases: [...e.cases].sort().join("") })),
  };

  // Combined link score
  const factors = [
    { key: "sharedAccounts", label: "Shared accounts", value: sharedAccounts.length, points: Math.min(40, sharedAccounts.length * 15) },
    { key: "sharedIdentifiers", label: "Shared identifiers", value: sharedIdentifiers.length, points: Math.min(30, sharedIdentifiers.length * 12) },
    { key: "crossCaseFlows", label: "Cross-case money flows (≤7 days)", value: crossCaseFlows.length, points: Math.min(20, crossCaseFlows.length * 2) },
    { key: "patternSimilarity", label: "Typology similarity", value: similarity.typologies, points: Math.round(similarity.typologies * 15) },
    { key: "highRiskGeo", label: "Common high-risk jurisdictions", value: geography.commonHighRisk.length, points: Math.min(15, geography.commonHighRisk.length * 8) },
    { key: "temporalOverlap", label: "Overlapping activity period", value: overlap ? overlap.days : 0, points: overlap ? 5 : 0 },
  ];
  const linkScore = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const linkLevel = linkScore >= 75 ? "critical" : linkScore >= 50 ? "high" : linkScore >= 25 ? "medium" : "low";

  const verdict =
    linkScore >= 50
      ? "Strong evidence that these cases are connected. Consider merging them into a single investigation."
      : linkScore >= 25
      ? "Moderate links detected. Review the shared entities and flows below."
      : sharedAccounts.length || sharedIdentifiers.length
      ? "Weak links detected. The cases share some entities but little else."
      : "No meaningful link between these cases was found.";

  return {
    linkScore,
    linkLevel,
    verdict,
    factors,
    sharedAccounts,
    sharedIdentifiers,
    crossCaseFlows: crossCaseFlows.slice(0, 100),
    similarity,
    commonTypologies,
    temporal,
    geography,
    network,
  };
};

module.exports = { compareCases, cosine };
