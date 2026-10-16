const DEFAULT_THRESHOLDS = require("../../config/thresholds");
const { screenAccounts } = require("./screening");

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const SEVERITY_WEIGHT = { critical: 30, high: 18, medium: 8, low: 3 };
const ACCOUNT_WEIGHT = { critical: 40, high: 25, medium: 12, low: 5 };

const FINDING_TYPES = {
  highValue: { label: "High-value transfer", category: "Value" },
  structuring: { label: "Structuring", category: "Value" },
  roundAmounts: { label: "Round-amount pattern", category: "Value" },
  circular: { label: "Circular flow", category: "Network" },
  passThrough: { label: "Rapid pass-through", category: "Network" },
  fanIn: { label: "Fan-in (smurfing)", category: "Network" },
  fanOut: { label: "Fan-out (dispersion)", category: "Network" },
  frequentPair: { label: "Repeated counterparty", category: "Behaviour" },
  rapidSuccession: { label: "Transaction burst", category: "Behaviour" },
  unusualTime: { label: "Off-hours activity", category: "Behaviour" },
  newAccount: { label: "New account, large value", category: "Behaviour" },
  highRiskGeo: { label: "High-risk jurisdiction", category: "Geography" },
  sharedIdentity: { label: "Shared identifiers", category: "Identity" },
  watchlist: { label: "Watchlist match", category: "Screening" },
  dormant: { label: "Dormant account reactivated", category: "Behaviour" },
  outlier: { label: "Out-of-pattern transfer", category: "Behaviour" },
  benford: { label: "Benford's law deviation", category: "Forensic" },
};

const BENFORD_EXPECTED = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => Math.log10(1 + 1 / d));
const firstDigit = (n) => {
  const s = String(Math.abs(n)).replace(/^[0.]+/, "");
  const d = Number(s[0]);
  return d >= 1 && d <= 9 ? d : null;
};

/**
 * First-digit Benford test with Nigrini's mean absolute deviation (MAD)
 * conformity ranges. Naturally occurring financial amounts follow Benford's
 * law; fabricated or manipulated amounts usually do not.
 */
const benfordTest = (amounts, minCount) => {
  const eligible = amounts.filter((a) => a >= 10);
  const counts = Array(9).fill(0);
  eligible.forEach((a) => {
    const d = firstDigit(a);
    if (d) counts[d - 1]++;
  });
  const n = counts.reduce((s, c) => s + c, 0);
  const digits = counts.map((count, i) => ({
    digit: i + 1,
    count,
    observed: n ? count / n : 0,
    expected: BENFORD_EXPECTED[i],
  }));
  const mad = n ? digits.reduce((s, d) => s + Math.abs(d.observed - d.expected), 0) / 9 : 0;
  const conformity = mad < 0.006 ? "close" : mad < 0.012 ? "acceptable" : mad < 0.015 ? "marginal" : "nonconformity";
  return { n, digits, mad: Math.round(mad * 10000) / 10000, conformity, applicable: n >= minCount };
};

const levelFromScore = (score) => {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
};

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
const time = (t) => (t.date ? new Date(t.date).getTime() : null);
const idOf = (t) => String(t._id ?? t.id);

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Find simple directed cycles (length 2..maxLength) in the transfer graph.
 * Each cycle is reported once using the rotation that starts with its
 * smallest node, which keeps the search bounded and deterministic.
 */
const findCycles = (adjacency, { maxLength, maxCycles, maxSteps = 200000 }) => {
  const nodes = [...adjacency.keys()].sort();
  const cycles = [];
  const seen = new Set();
  let steps = 0;

  for (const start of nodes) {
    if (cycles.length >= maxCycles || steps > maxSteps) break;
    const stack = [[start, [start]]];
    while (stack.length && cycles.length < maxCycles && steps++ <= maxSteps) {
      const [node, path] = stack.pop();
      for (const next of adjacency.get(node) || []) {
        if (next === start && path.length >= 2) {
          const key = path.join(">");
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push([...path]);
          }
        } else if (next > start && !path.includes(next) && path.length < maxLength) {
          stack.push([next, [...path, next]]);
        }
      }
    }
  }
  return cycles;
};

/**
 * Run every detection rule over a case.
 *
 * @param {object} input
 * @param {Array} input.transactions - { _id, fromAccount, toAccount, amount, date, country }
 * @param {Array} input.accounts - { accountNumber, accountHolder, openedAt, country, metadata }
 * @param {object} [thresholds]
 */
const analyzeCase = ({ transactions, accounts = [], watchlist = [] }, thresholds = DEFAULT_THRESHOLDS) => {
  const T = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const highRisk = new Set(T.HIGH_RISK_COUNTRIES);
  const findings = [];
  const txFlags = new Map(); // txId -> Set(types)
  const accountHits = new Map(); // account -> [{type, severity, title}]

  const accountMap = new Map(accounts.map((a) => [a.accountNumber, a]));
  const txById = new Map(transactions.map((t) => [idOf(t), t]));

  // `subjects` are the accounts the finding is about (they are risk-scored);
  // `accounts` additionally lists counterparties for context.
  const addFinding = ({ type, severity, title, description, subjects, accounts: accs = [], transactions: txIds = [], amount, meta }) => {
    const primary = [...new Set(subjects || accs)];
    const uniqueAccounts = [...new Set([...primary, ...accs])];
    const uniqueTx = [...new Set(txIds.map(String))];
    const finding = {
      id: `${type}-${findings.length + 1}`,
      type,
      category: FINDING_TYPES[type].category,
      label: FINDING_TYPES[type].label,
      severity,
      title,
      description,
      subjects: primary,
      accounts: uniqueAccounts,
      transactions: uniqueTx,
      amount: amount !== undefined ? round2(amount) : round2(sum(uniqueTx, (id) => txById.get(id)?.amount || 0)),
      meta: meta || {},
    };
    findings.push(finding);
    uniqueTx.forEach((id) => {
      if (!txFlags.has(id)) txFlags.set(id, new Set());
      txFlags.get(id).add(type);
    });
    primary.forEach((a) => {
      if (!accountHits.has(a)) accountHits.set(a, []);
      accountHits.get(a).push({ type, severity, title });
    });
    return finding;
  };

  const bySender = new Map();
  const byReceiver = new Map();
  for (const t of transactions) {
    if (!bySender.has(t.fromAccount)) bySender.set(t.fromAccount, []);
    bySender.get(t.fromAccount).push(t);
    if (!byReceiver.has(t.toAccount)) byReceiver.set(t.toAccount, []);
    byReceiver.get(t.toAccount).push(t);
  }
  const sortByTime = (arr) =>
    arr.filter((t) => time(t) !== null).sort((a, b) => time(a) - time(b));

  // 1. High-value transfers
  for (const t of transactions) {
    if (t.amount >= T.HIGH_VALUE) {
      addFinding({
        type: "highValue",
        severity: t.amount >= T.HIGH_VALUE * 5 ? "critical" : "high",
        title: `${fmt(t.amount)} sent from ${t.fromAccount} to ${t.toAccount}`,
        description: `Single transfer at or above the high-value threshold of ${fmt(T.HIGH_VALUE)}.`,
        subjects: [t.fromAccount],
        accounts: [t.fromAccount, t.toAccount],
        transactions: [idOf(t)],
      });
    }
  }

  // 2. Structuring - repeated amounts just below the reporting threshold
  const bandLow = T.REPORTING_THRESHOLD * (1 - T.STRUCTURING_BAND);
  for (const [account, txs] of bySender) {
    const near = txs.filter((t) => t.amount >= bandLow && t.amount < T.REPORTING_THRESHOLD);
    if (near.length >= T.STRUCTURING_MIN_COUNT) {
      addFinding({
        type: "structuring",
        severity: near.length >= T.STRUCTURING_MIN_COUNT * 2 ? "critical" : "high",
        title: `${account} made ${near.length} transfers just under ${fmt(T.REPORTING_THRESHOLD)}`,
        description: `Amounts between ${fmt(bandLow)} and ${fmt(T.REPORTING_THRESHOLD)} can indicate an attempt to avoid reporting requirements.`,
        subjects: [account],
        accounts: [account, ...near.map((t) => t.toAccount)],
        transactions: near.map(idOf),
        meta: { count: near.length },
      });
    }
  }

  // 3. Round-amount pattern
  for (const [account, txs] of bySender) {
    const round = txs.filter((t) => t.amount >= T.ROUND_AMOUNT.minAmount && t.amount % T.ROUND_AMOUNT.multiple === 0);
    if (round.length >= T.ROUND_AMOUNT.minCount) {
      addFinding({
        type: "roundAmounts",
        severity: "low",
        title: `${account} sent ${round.length} round-number transfers`,
        description: `Repeated exact multiples of ${fmt(T.ROUND_AMOUNT.multiple)} are atypical of genuine commercial activity.`,
        accounts: [account],
        transactions: round.map(idOf),
        meta: { count: round.length },
      });
    }
  }

  // 4. Circular flows
  const pairTx = new Map();
  for (const t of transactions) {
    if (t.fromAccount === t.toAccount) continue;
    const key = `${t.fromAccount}\u0000${t.toAccount}`;
    if (!pairTx.has(key)) pairTx.set(key, []);
    pairTx.get(key).push(t);
  }
  // Only transfers large enough to matter take part in the cycle search.
  const cycleAdjacency = new Map();
  for (const t of transactions) {
    if (t.fromAccount === t.toAccount || t.amount < T.CIRCULAR.minAmount) continue;
    if (!cycleAdjacency.has(t.fromAccount)) cycleAdjacency.set(t.fromAccount, new Set());
    cycleAdjacency.get(t.fromAccount).add(t.toAccount);
  }
  const cycles = findCycles(cycleAdjacency, T.CIRCULAR);
  const cycleWindow = T.CIRCULAR.windowDays * DAY;
  // Find a chain of transfers along the cycle that is chronological and
  // keeps a similar amount at every hop.
  const traceCycle = (cycle) => {
    const hops = cycle.map((from, i) =>
      (pairTx.get(`${from}\u0000${cycle[(i + 1) % cycle.length]}`) || [])
        .filter((t) => t.amount >= T.CIRCULAR.minAmount)
        .sort((a, b) => (time(a) ?? 0) - (time(b) ?? 0))
    );
    if (hops.some((h) => !h.length)) return null;
    for (const first of hops[0]) {
      const chain = [first];
      for (let i = 1; i < hops.length; i++) {
        const prev = chain[i - 1];
        const next = hops[i].find(
          (t) =>
            t.amount >= prev.amount * T.CIRCULAR.minRatio &&
            t.amount <= prev.amount * T.CIRCULAR.maxRatio &&
            (time(t) === null || time(prev) === null || (time(t) >= time(prev) && time(t) - time(first) <= cycleWindow))
        );
        if (!next) break;
        chain.push(next);
      }
      if (chain.length === hops.length) return chain;
    }
    return null;
  };
  for (const cycle of cycles) {
    const chain = traceCycle(cycle);
    if (!chain) continue;
    const returned = chain[chain.length - 1].amount;
    addFinding({
      type: "circular",
      severity: cycle.length >= 3 ? "critical" : "high",
      title:
        cycle.length === 2
          ? `Round-trip between ${cycle[0]} and ${cycle[1]}`
          : `Funds loop through ${cycle.length} accounts: ${[...cycle, cycle[0]].join(" → ")}`,
      description: `${fmt(chain[0].amount)} left ${cycle[0]} and ${fmt(returned)} came back through ${cycle.length - 1} intermediar${cycle.length - 1 > 1 ? "ies" : "y"} - a classic layering technique.`,
      accounts: cycle,
      transactions: chain.map(idOf),
      amount: chain[0].amount,
      meta: { path: [...cycle, cycle[0]], length: cycle.length },
    });
  }

  // 5. Rapid pass-through (received and forwarded quickly)
  const passWindow = T.PASS_THROUGH.windowHours * HOUR;
  for (const [account, incoming] of byReceiver) {
    const outgoing = sortByTime(bySender.get(account) || []);
    if (!outgoing.length) continue;
    const used = new Set();
    const pairs = [];
    for (const inTx of sortByTime(incoming)) {
      const tIn = time(inTx);
      if (inTx.amount < T.PASS_THROUGH.minAmount) continue;
      const out = outgoing.find(
        (o) =>
          !used.has(idOf(o)) &&
          o.toAccount !== inTx.fromAccount &&
          time(o) >= tIn &&
          time(o) - tIn <= passWindow &&
          o.amount >= inTx.amount * T.PASS_THROUGH.minRatio &&
          o.amount <= inTx.amount * 1.05
      );
      if (out) {
        used.add(idOf(out));
        pairs.push([inTx, out]);
      }
    }
    if (pairs.length) {
      const moved = sum(pairs, ([, o]) => o.amount);
      const minutes = Math.max(...pairs.map(([i, o]) => (time(o) - time(i)) / 60000));
      addFinding({
        type: "passThrough",
        severity: pairs.length >= 3 || moved >= T.HIGH_VALUE ? "high" : "medium",
        title: `${account} forwarded ${fmt(moved)} within ${Math.max(1, Math.round(minutes))} min of receiving it`,
        description: `Funds were passed on almost immediately (${pairs.length} occurrence${pairs.length > 1 ? "s" : ""}), typical of mule or shell accounts.`,
        subjects: [account],
        accounts: [account, ...pairs.flatMap(([i, o]) => [i.fromAccount, o.toAccount])],
        transactions: pairs.flat().map(idOf),
        amount: moved,
        meta: { intermediary: account, occurrences: pairs.length, paths: pairs.slice(0, 10).map(([i, o]) => [i.fromAccount, account, o.toAccount]) },
      });
    }
  }

  // 6. Fan-in / fan-out of small transfers within a sliding window
  const fanWindow = T.SMURFING.windowHours * HOUR;
  const fan = (groups, type, counterpartyKey) => {
    for (const [account, txs] of groups) {
      const small = sortByTime(txs).filter((t) => t.amount < T.REPORTING_THRESHOLD);
      let best = null;
      let lo = 0;
      for (let hi = 0; hi < small.length; hi++) {
        while (time(small[hi]) - time(small[lo]) > fanWindow) lo++;
        const windowTx = small.slice(lo, hi + 1);
        const parties = new Set(windowTx.map((t) => t[counterpartyKey]));
        if (parties.size >= T.SMURFING.minCounterparties && (!best || parties.size > best.parties.size)) {
          best = { windowTx, parties };
        }
      }
      if (best) {
        const total = sum(best.windowTx, (t) => t.amount);
        const n = best.parties.size;
        addFinding({
          type,
          severity: n >= T.SMURFING.minCounterparties * 2 || total >= T.REPORTING_THRESHOLD ? "high" : "medium",
          title:
            type === "fanIn"
              ? `${account} received ${best.windowTx.length} small transfers from ${n} accounts`
              : `${account} split funds into ${best.windowTx.length} small transfers to ${n} accounts`,
          description:
            type === "fanIn"
              ? `Many small deposits converging on one account within ${T.SMURFING.windowHours}h (total ${fmt(total)}) suggest smurfing.`
              : `Funds dispersed to many recipients within ${T.SMURFING.windowHours}h (total ${fmt(total)}) suggest layering.`,
          subjects: [account],
          accounts: [account, ...best.parties],
          transactions: best.windowTx.map(idOf),
          amount: total,
          meta: { counterparties: n },
        });
      }
    }
  };
  fan(byReceiver, "fanIn", "fromAccount");
  fan(bySender, "fanOut", "toAccount");

  // 7. Repeated counterparty
  for (const [key, txs] of pairTx) {
    if (txs.length > T.FREQUENT_PAIR_COUNT) {
      const [from, to] = key.split("\u0000");
      addFinding({
        type: "frequentPair",
        severity: txs.length > T.FREQUENT_PAIR_COUNT * 2 ? "high" : "medium",
        title: `${txs.length} transfers from ${from} to ${to}`,
        description: "Unusually frequent transfers between the same two accounts.",
        accounts: [from, to],
        transactions: txs.map(idOf),
        meta: { count: txs.length },
      });
    }
  }

  // 8. Transaction bursts
  const burstWindow = T.RAPID_SUCCESSIVE.minutes * 60000;
  for (const [account, txs] of bySender) {
    const sorted = sortByTime(txs);
    const inBurst = new Set();
    let lo = 0;
    for (let hi = 0; hi < sorted.length; hi++) {
      while (time(sorted[hi]) - time(sorted[lo]) > burstWindow) lo++;
      if (hi - lo + 1 >= T.RAPID_SUCCESSIVE.count) {
        for (let k = lo; k <= hi; k++) inBurst.add(sorted[k]);
      }
    }
    if (inBurst.size) {
      addFinding({
        type: "rapidSuccession",
        severity: inBurst.size >= T.RAPID_SUCCESSIVE.count * 2 ? "high" : "medium",
        title: `${account} sent ${inBurst.size} transfers in rapid succession`,
        description: `${T.RAPID_SUCCESSIVE.count}+ outgoing transfers within ${T.RAPID_SUCCESSIVE.minutes} minutes.`,
        accounts: [account],
        transactions: [...inBurst].map(idOf),
        meta: { count: inBurst.size },
      });
    }
  }

  // 9. Off-hours activity
  const [startHour, endHour] = T.UNUSUAL_HOURS;
  for (const [account, txs] of bySender) {
    const odd = txs.filter((t) => {
      if (time(t) === null) return false;
      const h = new Date(t.date).getUTCHours();
      return h >= startHour && h <= endHour;
    });
    if (odd.length) {
      addFinding({
        type: "unusualTime",
        severity: odd.length >= 3 ? "medium" : "low",
        title: `${account} transacted ${odd.length}× between ${String(startHour).padStart(2, "0")}:00 and ${String(endHour).padStart(2, "0")}:59`,
        description: "Activity during off-hours can indicate automated or concealed activity.",
        accounts: [account],
        transactions: odd.map(idOf),
        meta: { count: odd.length },
      });
    }
  }

  // 10. New account moving large sums (requires an account opening date)
  for (const [account, txs] of bySender) {
    const opened = accountMap.get(account)?.openedAt;
    if (!opened) continue;
    const openedTime = new Date(opened).getTime();
    const large = txs.filter((t) => {
      const tt = time(t);
      return tt !== null && tt - openedTime <= T.NEW_ACCOUNT_DAYS * DAY && tt >= openedTime && t.amount >= T.NEW_ACCOUNT_HIGH_VALUE;
    });
    if (large.length) {
      addFinding({
        type: "newAccount",
        severity: "high",
        title: `${account} moved ${fmt(sum(large, (t) => t.amount))} within ${T.NEW_ACCOUNT_DAYS} days of opening`,
        description: "Large transfers from a newly opened account are a common mule-account indicator.",
        accounts: [account],
        transactions: large.map(idOf),
      });
    }
  }

  // 11. High-risk jurisdictions
  const geoByAccount = new Map();
  for (const t of transactions) {
    const country = t.country || accountMap.get(t.fromAccount)?.country;
    if (country && highRisk.has(country)) {
      if (!geoByAccount.has(t.fromAccount)) geoByAccount.set(t.fromAccount, { countries: new Set(), txs: [] });
      const g = geoByAccount.get(t.fromAccount);
      g.countries.add(country);
      g.txs.push(t);
    }
  }
  for (const [account, g] of geoByAccount) {
    const countries = [...g.countries];
    addFinding({
      type: "highRiskGeo",
      severity: g.txs.length >= 3 ? "critical" : "high",
      title: `${account} transacted from high-risk jurisdiction${countries.length > 1 ? "s" : ""} ${countries.join(", ")}`,
      description: "Activity linked to jurisdictions under increased monitoring for money laundering or terrorist financing.",
      accounts: [account],
      transactions: g.txs.map(idOf),
      meta: { countries },
    });
  }

  // 12. Shared identifiers across distinct accounts (possible synthetic identities / mule rings)
  const identifierFields = [
    ["email", "email"],
    ["mobile", "phone number"],
    ["ipAddress", "IP address"],
  ];
  for (const [field, label] of identifierFields) {
    const groups = new Map();
    for (const a of accounts) {
      const v = a.metadata?.[field];
      if (!v) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(a.accountNumber);
    }
    for (const [value, accs] of groups) {
      if (accs.length < 2) continue;
      const set = new Set(accs);
      addFinding({
        type: "sharedIdentity",
        severity: accs.length >= 3 ? "critical" : "high",
        title: `${accs.length} accounts share the ${label} ${value}`,
        description: "Distinct accounts controlled through the same contact or device details may belong to one actor.",
        accounts: accs,
        transactions: transactions.filter((t) => set.has(t.fromAccount)).map(idOf),
        meta: { field, value },
      });
    }
  }

  // 13. Watchlist screening
  const hitsByAccount = new Map();
  for (const hit of screenAccounts(accounts, watchlist)) {
    if (!hitsByAccount.has(hit.account)) hitsByAccount.set(hit.account, []);
    hitsByAccount.get(hit.account).push(hit);
  }
  for (const [account, hits] of hitsByAccount) {
    const best = hits.sort((x, y) => y.score - x.score)[0];
    const fieldLabel = { account: "account number", email: "email", mobile: "phone", ipAddress: "IP address", accountHolder: "name" }[best.field];
    addFinding({
      type: "watchlist",
      severity: "critical",
      title: `${account} matches watchlist entry "${best.entry.value}"`,
      description:
        `The account's ${fieldLabel} (${best.value}) ${best.score < 1 ? `closely resembles (${Math.round(best.score * 100)}% similarity)` : "exactly matches"} a watchlist entry` +
        `${best.entry.note ? ` - ${best.entry.note}` : ""}.`,
      accounts: [account],
      transactions: transactions.filter((t) => t.fromAccount === account || t.toAccount === account).map(idOf),
      meta: { matches: hits.map((h) => ({ field: h.field, value: h.value, entry: h.entry.value, type: h.entry.type, score: h.score })) },
    });
  }

  // 14. Dormant account reactivation
  const activityByAccount = new Map();
  for (const t of transactions) {
    if (time(t) === null) continue;
    for (const acc of [t.fromAccount, t.toAccount]) {
      if (!activityByAccount.has(acc)) activityByAccount.set(acc, []);
      activityByAccount.get(acc).push(t);
    }
  }
  for (const [account, txs] of activityByAccount) {
    const sorted = txs.sort((a, b) => time(a) - time(b));
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = (time(sorted[i]) - time(sorted[i - 1])) / DAY;
      if (gapDays < T.DORMANT.days) continue;
      const start = time(sorted[i]);
      const burst = sorted.slice(i).filter((t) => time(t) - start <= T.DORMANT.windowDays * DAY);
      const moved = sum(burst, (t) => t.amount);
      const before = sorted.slice(0, i);
      const usual = sum(before, (t) => t.amount) / before.length;
      if (moved >= T.DORMANT.minAmount && moved >= usual * 3) {
        addFinding({
          type: "dormant",
          severity: "high",
          title: `${account} reactivated after ${Math.round(gapDays)} days and moved ${fmt(moved)}`,
          description: `The account was inactive for ${Math.round(gapDays)} days, then handled ${burst.length} transfer${burst.length > 1 ? "s" : ""} worth ${fmt(moved)} within ${T.DORMANT.windowDays} days - ${Math.round(moved / Math.max(usual, 1))}× its previous average. Dormant accounts are often taken over or sold to launder funds.`,
          subjects: [account],
          accounts: [account, ...burst.map((t) => (t.fromAccount === account ? t.toAccount : t.fromAccount))],
          transactions: burst.map(idOf),
          amount: moved,
          meta: { gapDays: Math.round(gapDays) },
        });
        break;
      }
    }
  }

  // 15. Out-of-pattern transfers relative to the sender's own history
  for (const [account, txs] of bySender) {
    if (txs.length < T.OUTLIER.minHistory) continue;
    const amounts = txs.map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const outliers = txs.filter((t) => t.amount < T.HIGH_VALUE && t.amount >= T.OUTLIER.minAmount && t.amount >= median * T.OUTLIER.multiple);
    if (outliers.length && outliers.length <= Math.max(2, txs.length * 0.2)) {
      const top = Math.max(...outliers.map((t) => t.amount));
      addFinding({
        type: "outlier",
        severity: top >= median * T.OUTLIER.multiple * 5 ? "high" : "medium",
        title: `${account} sent ${fmt(top)} - ${Math.round(top / median)}× its typical transfer`,
        description: `This account usually sends around ${fmt(median)} (median of ${txs.length} transfers). ${outliers.length === 1 ? "One transfer is" : `${outliers.length} transfers are`} at least ${T.OUTLIER.multiple}× larger, which breaks its established behaviour.`,
        subjects: [account],
        accounts: [account, ...outliers.map((t) => t.toAccount)],
        transactions: outliers.map(idOf),
        meta: { median, multiple: Math.round(top / median) },
      });
    }
  }

  // 16. Benford's law (dataset-wide forensic test)
  const benford = benfordTest(transactions.map((t) => t.amount), T.BENFORD.minCount);
  if (benford.applicable && benford.conformity === "nonconformity") {
    const spikes = benford.digits
      .filter((d) => d.observed - d.expected > 0.02)
      .sort((a, b) => b.observed - b.expected - (a.observed - a.expected))
      .slice(0, 2)
      .map((d) => d.digit);
    // Accounts that concentrate their transfers on the over-represented digits.
    const contributors = [...bySender.entries()]
      .map(([account, txs]) => {
        const hit = txs.filter((t) => spikes.includes(firstDigit(t.amount)));
        return { account, hit, share: hit.length / txs.length };
      })
      .filter((c) => c.hit.length >= 3 && c.share >= 0.6)
      .sort((a, b) => b.hit.length - a.hit.length)
      .slice(0, 10);
    addFinding({
      type: "benford",
      severity: benford.mad >= 0.03 ? "high" : "medium",
      title: `Amounts deviate from Benford's law (MAD ${benford.mad.toFixed(4)})`,
      description: `In natural financial data about 30% of amounts start with 1. Here ${spikes.length ? `leading digit${spikes.length > 1 ? "s" : ""} ${spikes.join(" and ")} ${spikes.length > 1 ? "are" : "is"} over-represented` : "the first-digit distribution is unusual"}, which can indicate fabricated, manipulated or threshold-driven amounts.${contributors.length ? " The listed accounts concentrate on those digits." : ""}`,
      subjects: contributors.map((c) => c.account),
      accounts: contributors.map((c) => c.account),
      transactions: contributors.flatMap((c) => c.hit).map(idOf),
      meta: { mad: benford.mad, spikes },
    });
  }

  // ---- Account profiles & risk -------------------------------------------
  const allAccountNumbers = new Set([...accountMap.keys(), ...bySender.keys(), ...byReceiver.keys()]);
  const accountRisk = [...allAccountNumbers].map((number) => {
    const sent = bySender.get(number) || [];
    const received = byReceiver.get(number) || [];
    const hits = accountHits.get(number) || [];
    const info = accountMap.get(number) || {};
    // Only count each finding type once at its highest severity so that a
    // single noisy rule cannot saturate the score on its own.
    const bestByType = new Map();
    for (const h of hits) {
      const prev = bestByType.get(h.type);
      if (!prev || ACCOUNT_WEIGHT[h.severity] > ACCOUNT_WEIGHT[prev.severity]) bestByType.set(h.type, h);
    }
    const score = Math.min(100, sum([...bestByType.values()], (h) => ACCOUNT_WEIGHT[h.severity]));
    return {
      account: number,
      holder: info.accountHolder,
      type: info.accountType,
      country: info.country || sent.find((t) => t.country)?.country,
      inflow: round2(sum(received, (t) => t.amount)),
      outflow: round2(sum(sent, (t) => t.amount)),
      sent: sent.length,
      received: received.length,
      score,
      level: levelFromScore(score),
      reasons: [...bestByType.values()]
        .sort((a, b) => ACCOUNT_WEIGHT[b.severity] - ACCOUNT_WEIGHT[a.severity])
        .map((h) => FINDING_TYPES[h.type].label),
    };
  });
  accountRisk.sort((a, b) => b.score - a.score || b.outflow + b.inflow - (a.outflow + a.inflow));

  // ---- Network -----------------------------------------------------------
  const edges = [...pairTx.entries()].map(([key, txs]) => {
    const [from, to] = key.split("\u0000");
    return {
      from,
      to,
      totalAmount: round2(sum(txs, (t) => t.amount)),
      count: txs.length,
      flagged: txs.some((t) => txFlags.has(idOf(t))),
    };
  });
  const nodes = accountRisk.map((a) => ({
    id: a.account,
    label: a.holder || a.account,
    score: a.score,
    level: a.level,
    inflow: a.inflow,
    outflow: a.outflow,
    country: a.country,
  }));

  // ---- Summary & overall risk -------------------------------------------
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};
  for (const f of findings) {
    severityCounts[f.severity]++;
    byType[f.type] = (byType[f.type] || 0) + 1;
  }
  // Diminishing returns: each extra finding adds less to the overall score.
  const findingsScore = 100 * (1 - Math.exp(-sum(findings, (f) => SEVERITY_WEIGHT[f.severity]) / 120));
  const topAccount = accountRisk[0]?.score || 0;
  const riskScore = Math.round(0.65 * findingsScore + 0.35 * topAccount);

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.amount - a.amount);

  const flaggedTransactions = {};
  for (const [id, types] of txFlags) flaggedTransactions[id] = [...types];

  // Hourly / daily activity profile
  const hourly = Array(24).fill(0);
  const dailyMap = new Map();
  for (const t of transactions) {
    if (time(t) === null) continue;
    const d = new Date(t.date);
    hourly[d.getUTCHours()]++;
    const day = d.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) || { date: day, count: 0, volume: 0, flagged: 0 };
    entry.count++;
    entry.volume = round2(entry.volume + t.amount);
    if (txFlags.has(idOf(t))) entry.flagged++;
    dailyMap.set(day, entry);
  }

  const countryMap = new Map();
  for (const t of transactions) {
    const c = t.country || accountMap.get(t.fromAccount)?.country;
    if (!c) continue;
    const entry = countryMap.get(c) || { country: c, count: 0, volume: 0, highRisk: highRisk.has(c), flagged: 0 };
    entry.count++;
    entry.volume = round2(entry.volume + t.amount);
    if (txFlags.has(idOf(t))) entry.flagged++;
    countryMap.set(c, entry);
  }

  return {
    riskScore,
    riskLevel: levelFromScore(riskScore),
    summary: {
      totalFindings: findings.length,
      severity: severityCounts,
      byType,
      flaggedTransactions: txFlags.size,
      highRiskAccounts: accountRisk.filter((a) => a.level === "high" || a.level === "critical").length,
    },
    findings,
    accountRisk,
    network: { nodes, edges },
    activity: {
      hourly,
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    },
    geography: [...countryMap.values()].sort((a, b) => b.volume - a.volume),
    benford,
    flaggedTransactions,
    thresholds: {
      highValue: T.HIGH_VALUE,
      reportingThreshold: T.REPORTING_THRESHOLD,
      highRiskCountries: T.HIGH_RISK_COUNTRIES,
    },
  };
};

module.exports = { analyzeCase, findCycles, levelFromScore, benfordTest, FINDING_TYPES };
