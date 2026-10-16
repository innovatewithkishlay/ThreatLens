const csv = require("csv-parser");
const { Readable } = require("stream");

// Canonical field -> accepted (normalised) header names.
const FIELD_ALIASES = {
  fromAccount: ["fromaccount", "from", "fromacct", "sender", "senderaccount", "source", "sourceaccount", "debitaccount", "originator", "originatoraccount", "payer", "payeraccount"],
  toAccount: ["toaccount", "to", "toacct", "receiver", "receiveraccount", "recipient", "recipientaccount", "beneficiary", "beneficiaryaccount", "destination", "destinationaccount", "creditaccount", "payee", "payeeaccount"],
  amount: ["amount", "amt", "value", "transactionamount", "txnamount", "sum"],
  date: ["date", "timestamp", "datetime", "transactiondate", "txndate", "time", "createdat", "valuedate"],
  country: ["metadataipcountry", "ipcountry", "country", "countrycode", "location", "geo"],
  reference: ["transactionid", "txnid", "txid", "reference", "ref", "id"],
  description: ["description", "memo", "narrative", "note", "notes", "details"],
  currency: ["currency", "ccy", "currencycode"],
  accountNumber: ["accountnumber", "account", "accountno", "acctnumber"],
  accountHolder: ["accountholder", "holder", "accountname", "name", "customername"],
  accountType: ["accounttype", "type"],
  accountOpened: ["accountopened", "openedat", "opendate", "accountopendate", "accountcreated"],
  email: ["email", "emailaddress", "mail"],
  mobile: ["mobile", "phone", "phonenumber", "mobilenumber", "contact"],
  ipAddress: ["ipaddress", "ip", "ipaddr"],
  fromName: ["fromname", "sendername", "originatorname", "payername"],
  toName: ["toname", "receivername", "recipientname", "beneficiaryname", "payeename"],
};

const REQUIRED_FIELDS = ["fromAccount", "toAccount", "amount"];

const normaliseHeader = (h) =>
  String(h || "")
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const resolveColumns = (headers) => {
  const normalised = headers.map(normaliseHeader);
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    // Prefer the earliest alias (most specific) that is present.
    for (const alias of aliases) {
      const idx = normalised.indexOf(alias);
      if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
};

const detectSeparator = (text) => {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length - 1;
    if (count > bestCount) {
      best = sep;
      bestCount = count;
    }
  }
  return best;
};

const parseAmount = (raw) => {
  if (raw === undefined || raw === null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\s]/g, "").replace(/[^0-9.,-]/g, "").replace(/^-/, "");
  if (!/\d/.test(s)) return NaN;
  // "1.234,56" (European) vs "1,234.56"
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
};

// Dates without an explicit timezone are treated as UTC so the recorded
// wall-clock time is preserved regardless of the server's timezone.
const parseDate = (raw) => {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const [, y, mo, d, h = "00", mi = "00", sec = "00", tz] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec}${tz ? tz.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2") : "Z"}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  // DD/MM/YYYY or DD-MM-YYYY (optionally with time). Ambiguous MM/DD is
  // resolved as day-first unless the first part is > 12.
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    let [, a, b, y, h = "0", mi = "0", sec = "0"] = m;
    let day = Number(a);
    let month = Number(b);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const date = new Date(Date.UTC(Number(y), month - 1, day, Number(h), Number(mi), Number(sec)));
    if (date.getUTCMonth() !== month - 1) return undefined;
    return date;
  }

  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    return new Date(s.length === 10 ? n * 1000 : n);
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const clean = (v, max = 200) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s.slice(0, max) : undefined;
};

const readRows = (buffer, separator) =>
  new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];
    Readable.from(buffer)
      .pipe(
        csv({
          separator,
          mapHeaders: ({ header }) => header.replace(/^﻿/, "").trim(),
          skipLines: 0,
          strict: false,
        })
      )
      .on("headers", (h) => {
        headers = h;
      })
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve({ headers, rows }))
      .on("error", reject);
  });

class CsvValidationError extends Error {
  constructor(message, details = [], extra = {}) {
    super(message);
    this.name = "CsvValidationError";
    this.status = 400;
    this.details = details;
    Object.assign(this, extra);
  }
}

/**
 * Parse a transaction CSV buffer into normalised transactions and accounts.
 */
const parseTransactionsCsv = async (buffer, { maxRows = 25000 } = {}) => {
  const text = buffer.toString("utf8");
  if (!text.trim()) {
    throw new CsvValidationError("The CSV file is empty.", [
      "Make sure the file contains a header row and at least one transaction.",
    ]);
  }

  const { headers, rows } = await readRows(buffer, detectSeparator(text));
  const columns = resolveColumns(headers);
  const missing = REQUIRED_FIELDS.filter((f) => !columns[f]);
  if (missing.length) {
    throw new CsvValidationError(
      "Your CSV file is missing required columns.",
      missing.map((f) => `Missing column: ${f} (accepted names: ${FIELD_ALIASES[f].slice(0, 5).join(", ")} ...)`),
      { found: headers }
    );
  }
  if (rows.length === 0) {
    throw new CsvValidationError("The CSV file has a header but no data rows.");
  }
  if (rows.length > maxRows) {
    throw new CsvValidationError(`The CSV file has ${rows.length.toLocaleString()} rows. The maximum is ${maxRows.toLocaleString()}.`, [
      "Split the file into smaller cases or raise MAX_ROWS on the server.",
    ]);
  }

  const get = (row, field) => (columns[field] ? row[columns[field]] : undefined);
  const transactions = [];
  const accounts = new Map();
  const errors = [];
  let skipped = 0;
  const currencies = new Map();

  const touchAccount = (number, patch = {}) => {
    if (!number) return;
    const existing = accounts.get(number) || { accountNumber: number, metadata: {} };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") continue;
      if (k === "metadata") {
        for (const [mk, mv] of Object.entries(v)) {
          if (mv && !existing.metadata[mk]) existing.metadata[mk] = mv;
        }
      } else if (existing[k] === undefined) {
        existing[k] = v;
      }
    }
    accounts.set(number, existing);
  };

  rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const values = Object.values(row).map((v) => String(v ?? "").trim());
    if (values.every((v) => v === "")) {
      skipped++;
      return;
    }

    const fromAccount = clean(get(row, "fromAccount"), 64);
    const toAccount = clean(get(row, "toAccount"), 64);
    const amount = parseAmount(get(row, "amount"));
    const rawDate = get(row, "date");
    const date = parseDate(rawDate);

    const problems = [];
    if (!fromAccount) problems.push("missing fromAccount");
    if (!toAccount) problems.push("missing toAccount");
    if (Number.isNaN(amount)) problems.push(`invalid amount "${clean(get(row, "amount"), 30) ?? ""}"`);
    else if (amount <= 0) problems.push("amount must be greater than zero");
    if (date === undefined) problems.push(`invalid date "${clean(rawDate, 40)}"`);

    if (problems.length) {
      skipped++;
      if (errors.length < 25) errors.push(`Row ${line}: ${problems.join(", ")}`);
      return;
    }

    const country = clean(get(row, "country"), 8)?.toUpperCase();
    const currency = clean(get(row, "currency"), 8)?.toUpperCase();
    if (currency) currencies.set(currency, (currencies.get(currency) || 0) + 1);

    transactions.push({
      row: line,
      reference: clean(get(row, "reference"), 80),
      fromAccount,
      toAccount,
      amount: Math.round(amount * 100) / 100,
      currency,
      date,
      description: clean(get(row, "description"), 300),
      country,
    });

    // Account-level attributes in the row describe the account named in
    // `accountNumber` if present, otherwise the sender.
    const subject = clean(get(row, "accountNumber"), 64) || fromAccount;
    touchAccount(subject, {
      accountHolder: clean(get(row, "accountHolder"), 120),
      accountType: clean(get(row, "accountType"), 40)?.toLowerCase(),
      openedAt: parseDate(get(row, "accountOpened")) || undefined,
      country: subject === fromAccount ? country : undefined,
      metadata: {
        email: clean(get(row, "email"), 120)?.toLowerCase(),
        mobile: clean(get(row, "mobile"), 40)?.replace(/[\s()-]/g, ""),
        ipAddress: clean(get(row, "ipAddress"), 64),
      },
    });
    touchAccount(fromAccount, { accountHolder: clean(get(row, "fromName"), 120), country });
    touchAccount(toAccount, { accountHolder: clean(get(row, "toName"), 120) });
  });

  if (transactions.length === 0) {
    throw new CsvValidationError("No valid transactions were found in the file.", errors.length ? errors : ["Every row was empty or invalid."]);
  }

  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    transactions,
    accounts: [...accounts.values()],
    columns,
    skipped,
    errors,
    currency,
  };
};

module.exports = {
  parseTransactionsCsv,
  parseAmount,
  parseDate,
  resolveColumns,
  CsvValidationError,
  FIELD_ALIASES,
};
