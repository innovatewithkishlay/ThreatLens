/**
 * Generates the demo CSV files shipped with the frontend
 * (frontend/public/samples). Output is deterministic.
 *
 *   node scripts/generate-samples.js
 */
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../../frontend/public/samples");

let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.round(min + rand() * (max - min));
// Log-normal amounts look like real payments (and follow Benford's law).
const naturalAmount = (median = 900, spread = 1.1, max = 8500) => {
  const z = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
  return Math.min(max, Math.max(20, Math.round(median * Math.exp(spread * z) * 100) / 100));
};

const FIRST = ["Olivia", "Liam", "Amara", "Noah", "Priya", "Lucas", "Sofia", "Mateo", "Hana", "Ethan", "Zara", "Leo", "Maya", "Omar", "Elena", "Kenji", "Aisha", "Daniel", "Ines", "Victor"];
const LAST = ["Carter", "Okafor", "Silva", "Novak", "Sharma", "Muller", "Rossi", "Tanaka", "Haddad", "Brooks", "Ivanova", "Kim", "Moreau", "Mensah", "Larsen"];
const SAFE_COUNTRIES = ["GB", "US", "DE", "FR", "IN", "NL", "ES", "SG", "AE", "CA"];

const header = [
  "transactionId", "date", "fromAccount", "toAccount", "amount", "currency", "metadata.ipCountry", "description",
  "accountNumber", "accountHolder", "accountType", "accountOpened", "email", "mobile", "ipAddress",
];

const makeProfiles = (prefix, start, count) => {
  const profiles = {};
  for (let i = 0; i < count; i++) {
    const acc = `${prefix}${start + i}`;
    const first = pick(FIRST);
    const last = pick(LAST);
    profiles[acc] = {
      holder: `${first} ${last}`,
      type: rand() < 0.3 ? "business" : "personal",
      opened: `20${between(18, 24)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
      email: `${first}.${last}${between(1, 99)}@mail.example`.toLowerCase(),
      mobile: `+44 7${between(100, 999)} ${between(100000, 999999)}`,
      ip: `${between(11, 220)}.${between(0, 255)}.${between(0, 255)}.${between(1, 254)}`,
      country: pick(SAFE_COUNTRIES),
    };
  }
  return profiles;
};

const writeCase = (file, profiles, rows) => {
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const lines = [header.join(",")];
  rows.forEach((r, i) => {
    const p = profiles[r.from] || {};
    const values = [
      r.id || `TX-${file.slice(-5, -4).toUpperCase()}${String(i + 1).padStart(5, "0")}`,
      r.date,
      r.from,
      r.to,
      r.amount.toFixed(2),
      "USD",
      r.country || p.country || "",
      r.desc || pick(["Invoice payment", "Transfer", "Services", "Consulting fee", "Goods", "Rent", "Loan repayment", "Payroll"]),
      r.from,
      p.holder || "",
      p.type || "",
      p.opened || "",
      p.email || "",
      p.mobile || "",
      p.ip || "",
    ].map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v));
    lines.push(values.join(","));
  });
  fs.writeFileSync(path.join(OUT, file), lines.join("\n") + "\n");
  console.log(`wrote ${file} (${rows.length} rows)`);
};

const ts = (day, h, m) => `2025-06-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

// ---------------------------------------------------------------- Case A
const A = makeProfiles("ACC", 1001, 20);
Object.assign(A, makeProfiles("ACC", 2001, 7));
const accountsA = Object.keys(A).filter((a) => a.startsWith("ACC10"));
const rowsA = [];

// Ordinary business activity
for (let i = 0; i < 120; i++) {
  const from = pick(accountsA);
  let to = pick(accountsA);
  while (to === from) to = pick(accountsA);
  rowsA.push({ date: ts(between(1, 14), between(8, 18), between(0, 59)), from, to, amount: naturalAmount() });
}

// Structuring just below 10,000
[9500, 9800, 9750, 9900].forEach((amount, i) =>
  rowsA.push({ date: ts(3 + i, 11, 15 + i), from: "ACC1007", to: accountsA[(i * 3) % 20], amount, desc: "Cash deposit transfer" })
);

// High-value and round-number transfers
rowsA.push({ date: ts(4, 14, 2), from: "ACC1003", to: "ACC1012", amount: 75000, desc: "Asset purchase" });
rowsA.push({ date: ts(9, 15, 40), from: "ACC1003", to: "ACC1009", amount: 260000, desc: "Property deposit" });
[5000, 10000, 20000].forEach((amount, i) => rowsA.push({ date: ts(6 + i, 10, 5), from: "ACC1003", to: "ACC1006", amount, desc: "Advance" }));

// Circular flow ACC1010 -> ACC1011 -> ACC1013 -> ACC1010
rowsA.push({ date: ts(5, 9, 0), from: "ACC1010", to: "ACC1011", amount: 48000, desc: "Consulting fee" });
rowsA.push({ date: ts(5, 13, 30), from: "ACC1011", to: "ACC1013", amount: 47200, desc: "Subcontract" });
rowsA.push({ date: ts(6, 8, 45), from: "ACC1013", to: "ACC1010", amount: 46500, desc: "Refund" });

// Pass-through mule ACC1015
rowsA.push({ date: ts(7, 10, 0), from: "ACC1002", to: "ACC1015", amount: 30000, desc: "Investment" });
rowsA.push({ date: ts(7, 10, 25), from: "ACC1015", to: "ACC1016", amount: 29500, desc: "Transfer" });
rowsA.push({ date: ts(8, 16, 0), from: "ACC1004", to: "ACC1015", amount: 18000, desc: "Investment" });
rowsA.push({ date: ts(8, 16, 40), from: "ACC1015", to: "ACC1017", amount: 17600, desc: "Transfer" });

// Fan-in (smurfing) into ACC1018 from seven fresh accounts
for (let i = 0; i < 7; i++) {
  rowsA.push({ date: ts(10, 9 + i, between(0, 59)), from: `ACC${2001 + i}`, to: "ACC1018", amount: between(1500, 3200), desc: "Gift" });
}

// Fan-out from ACC1019
for (let i = 0; i < 6; i++) {
  rowsA.push({ date: ts(11, 9 + i, 10), from: "ACC1019", to: accountsA[i + 1], amount: between(800, 2500), desc: "Payout" });
}

// Burst from ACC1020 (6 transfers in 8 minutes)
for (let i = 0; i < 6; i++) {
  rowsA.push({ date: ts(12, 14, 1 + i), from: "ACC1020", to: accountsA[(i * 2 + 3) % 20], amount: between(300, 900), desc: "Transfer" });
}

// Off-hours activity
rowsA.push({ date: ts(9, 2, 13), from: "ACC1008", to: "ACC1014", amount: 6400 });
rowsA.push({ date: ts(10, 3, 41), from: "ACC1008", to: "ACC1014", amount: 7100 });

// High-risk jurisdictions
rowsA.push({ date: ts(9, 12, 0), from: "ACC1014", to: "ACC1001", amount: 22000, country: "IR", desc: "Trade settlement" });
rowsA.push({ date: ts(11, 12, 30), from: "ACC1014", to: "ACC1005", amount: 15500, country: "NG", desc: "Trade settlement" });

// Repeated counterparty
for (let i = 0; i < 7; i++) rowsA.push({ date: ts(1 + i * 2, 17, 5), from: "ACC1004", to: "ACC1005", amount: between(900, 1300), desc: "Invoice payment" });

// New account moving large sums
A.ACC1016.opened = "2025-06-05";
rowsA.push({ date: ts(8, 11, 20), from: "ACC1016", to: "ACC1009", amount: 25000, desc: "Transfer" });

// Dormant account reactivated: quiet since April, then a large burst
A.ACC1021 = { holder: "Marta Kowalski", type: "personal", opened: "2016-03-14", email: "m.kowalski@mail.example", mobile: "+44 7311 482019", ip: "81.2.69.160", country: "GB" };
rowsA.push({ id: "TX-A-DORM1", date: "2025-04-11T10:12:00", from: "ACC1021", to: "UTILCO-01", amount: 140, desc: "Utilities" });
rowsA.push({ id: "TX-A-DORM2", date: "2025-06-12T09:03:00", from: "ACC1002", to: "ACC1021", amount: 26000, desc: "Loan" });
rowsA.push({ id: "TX-A-DORM3", date: "2025-06-12T16:40:00", from: "ACC1021", to: "ACC1009", amount: 25200, desc: "Transfer" });

// Shared identifiers
A.ACC1011.email = A.ACC1010.email;
A.ACC1013.mobile = A.ACC1010.mobile;
A.ACC1013.ip = A.ACC1010.ip;

writeCase("sample-case-a.csv", A, rowsA);

// ---------------------------------------------------------------- Case B
seed = 7;
const B = makeProfiles("ACC", 3001, 14);
// Accounts shared with case A
B.ACC1015 = { ...A.ACC1015 };
B.ACC1018 = { ...A.ACC1018 };
B.ACC3004.email = A.ACC1010.email; // same controller
const accountsB = Object.keys(B);
const rowsB = [];

for (let i = 0; i < 60; i++) {
  const from = pick(accountsB);
  let to = pick(accountsB);
  while (to === from) to = pick(accountsB);
  rowsB.push({ date: ts(between(8, 20), between(8, 18), between(0, 59)), from, to, amount: naturalAmount() });
}

// Funds collected in case A leave via the same mule accounts
rowsB.push({ date: ts(10, 18, 5), from: "ACC1018", to: "ACC3002", amount: 14800, desc: "Transfer", country: "NG" });
rowsB.push({ date: ts(8, 17, 10), from: "ACC1017", to: "ACC1015", amount: 17000, desc: "Return" });
rowsB.push({ date: ts(8, 17, 35), from: "ACC1015", to: "ACC3006", amount: 16700, desc: "Transfer" });
rowsB.push({ date: ts(12, 9, 0), from: "ACC3006", to: "ACC3007", amount: 9600, desc: "Transfer" });
rowsB.push({ date: ts(12, 9, 50), from: "ACC3006", to: "ACC3008", amount: 9400, desc: "Transfer" });
rowsB.push({ date: ts(13, 1, 30), from: "ACC3004", to: "ACC3009", amount: 52000, desc: "Asset purchase", country: "NG" });
rowsB.push({ date: ts(14, 10, 0), from: "ACC3009", to: "ACC3004", amount: 50500, desc: "Refund" });

writeCase("sample-case-b.csv", B, rowsB);
