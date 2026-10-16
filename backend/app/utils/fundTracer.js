/**
 * Follow-the-money tracing.
 *
 * Forward tracing answers "where did the money from X end up?"; backward
 * tracing answers "where did the money that reached X come from?".
 *
 * Transfers are replayed in time order. Each account carries a "traced"
 * balance; when it sends money, the traced part of the transfer is
 * min(amount, traced balance) - the conservative "tainted funds leave first"
 * assumption (LIFO) commonly used for worst-case asset tracing.
 */

const round2 = (n) => Math.round(n * 100) / 100;
const ts = (t) => (t.date ? new Date(t.date).getTime() : null);

const traceFunds = (transactions, origin, { direction = "forward", maxHops = 6, from, to } = {}) => {
  const forward = direction !== "backward";
  const fromTime = from ? new Date(from).getTime() : -Infinity;
  const toTime = to ? new Date(to).getTime() : Infinity;

  // Replay order: chronological (forward) or reverse chronological (backward).
  // Undated transfers keep their file order.
  const ordered = transactions
    .map((t, i) => ({ t, i, time: ts(t) }))
    .filter(({ time }) => time === null || (time >= fromTime && time <= toTime))
    .sort((a, b) => {
      if (a.time !== null && b.time !== null && a.time !== b.time) return a.time - b.time;
      return (a.t.row ?? a.i) - (b.t.row ?? b.i);
    });
  if (!forward) ordered.reverse();

  const balance = new Map(); // traced funds held (forward) / still unexplained (backward)
  const hop = new Map([[origin, 0]]);
  const firstSeen = new Map();
  const edges = new Map();
  const nodeIn = new Map();
  const nodeOut = new Map();
  let total = 0;

  const add = (map, k, v) => map.set(k, (map.get(k) || 0) + v);

  for (const { t, time } of ordered) {
    // In forward mode money moves from -> to; backward we walk to -> from.
    const src = forward ? t.fromAccount : t.toAccount;
    const dst = forward ? t.toAccount : t.fromAccount;
    if (src === dst) continue;

    let traced;
    if (src === origin) {
      traced = t.amount;
      total += traced;
    } else {
      const available = balance.get(src) || 0;
      if (available <= 0.005) continue;
      const h = hop.get(src);
      if (h === undefined || h >= maxHops) continue;
      traced = Math.min(t.amount, available);
      balance.set(src, available - traced);
    }
    if (dst === origin) continue; // funds returning to origin end the trail
    const nextHop = (hop.get(src) || 0) + 1;
    if (!hop.has(dst) || hop.get(dst) > nextHop) hop.set(dst, nextHop);
    if (!firstSeen.has(dst) && time !== null) firstSeen.set(dst, time);
    add(balance, dst, traced);
    add(nodeOut, src, traced);
    add(nodeIn, dst, traced);

    const key = `${src}\u0000${dst}`;
    const e = edges.get(key) || { from: src, to: dst, amount: 0, count: 0, transactions: [], hop: nextHop };
    e.amount += traced;
    e.count++;
    if (e.transactions.length < 50) e.transactions.push(String(t._id));
    e.hop = Math.min(e.hop, nextHop);
    edges.set(key, e);
  }

  const nodes = [...hop.keys()]
    .filter((id) => id === origin || nodeIn.has(id))
    .map((id) => ({
      account: id,
      hop: hop.get(id),
      received: round2(nodeIn.get(id) || 0),
      passedOn: round2(nodeOut.get(id) || 0),
      // Funds that stopped here (forward: still held; backward: original source).
      retained: id === origin ? 0 : round2(Math.max(0, balance.get(id) || 0)),
      firstSeen: firstSeen.has(id) ? new Date(firstSeen.get(id)).toISOString() : null,
    }))
    .sort((a, b) => a.hop - b.hop || b.received - a.received);

  const endpoints = nodes.filter((n) => n.retained > 0.005).sort((a, b) => b.retained - a.retained);

  return {
    origin,
    direction: forward ? "forward" : "backward",
    maxHops,
    totalTraced: round2(total),
    nodes,
    edges: [...edges.values()].map((e) => ({ ...e, amount: round2(e.amount) })).sort((a, b) => a.hop - b.hop || b.amount - a.amount),
    endpoints,
    depth: Math.max(0, ...nodes.map((n) => n.hop)),
  };
};

module.exports = { traceFunds };
