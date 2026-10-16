// Lightweight client-side CSV inspection so users get instant feedback
// before uploading. Mirrors the server's column aliases.
const ALIASES: Record<string, string[]> = {
  fromAccount: ["fromaccount", "from", "fromacct", "sender", "senderaccount", "source", "sourceaccount", "debitaccount", "originator", "originatoraccount", "payer", "payeraccount"],
  toAccount: ["toaccount", "to", "toacct", "receiver", "receiveraccount", "recipient", "recipientaccount", "beneficiary", "beneficiaryaccount", "destination", "destinationaccount", "creditaccount", "payee", "payeeaccount"],
  amount: ["amount", "amt", "value", "transactionamount", "txnamount", "sum"],
  date: ["date", "timestamp", "datetime", "transactiondate", "txndate", "time", "createdat", "valuedate"],
  country: ["metadataipcountry", "ipcountry", "country", "countrycode", "location", "geo"],
  email: ["email", "emailaddress", "mail"],
  mobile: ["mobile", "phone", "phonenumber", "mobilenumber", "contact"],
  ipAddress: ["ipaddress", "ip", "ipaddr"],
  accountOpened: ["accountopened", "openedat", "opendate", "accountopendate", "accountcreated"],
};

export const FIELD_LABELS: Record<string, { label: string; required?: boolean; unlocks: string }> = {
  fromAccount: { label: "From account", required: true, unlocks: "Sender of each transfer" },
  toAccount: { label: "To account", required: true, unlocks: "Receiver of each transfer" },
  amount: { label: "Amount", required: true, unlocks: "Value-based detections" },
  date: { label: "Date / time", unlocks: "Timeline, bursts, pass-through, off-hours" },
  country: { label: "Country", unlocks: "Geographic risk & map" },
  email: { label: "Email", unlocks: "Shared-identity detection" },
  mobile: { label: "Phone", unlocks: "Shared-identity detection" },
  ipAddress: { label: "IP address", unlocks: "Shared-identity detection" },
  accountOpened: { label: "Account opened", unlocks: "New-account detection" },
};

const normalise = (h: string) => h.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const splitLine = (line: string, sep: string) => {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  rowCount: number;
  mapping: Record<string, string | undefined>;
  missingRequired: string[];
}

export const previewCsv = async (file: File, maxRows = 6): Promise<CsvPreview> => {
  const text = await file.slice(0, 512 * 1024).text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const first = lines[0] || "";
  const sep = [",", ";", "\t", "|"].reduce((best, s) => (first.split(s).length > first.split(best).length ? s : best), ",");
  const headers = splitLine(first, sep);
  const norm = headers.map(normalise);
  const mapping: Record<string, string | undefined> = {};
  const used = new Set<number>();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const idx = norm.indexOf(alias);
      if (idx !== -1 && !used.has(idx)) {
        mapping[field] = headers[idx];
        used.add(idx);
        break;
      }
    }
  }
  // Estimate total rows from file size when only part of it was read.
  const sampleRows = Math.max(lines.length - 1, 0);
  const rowCount = file.size > 512 * 1024 ? Math.round((sampleRows * file.size) / (512 * 1024)) : sampleRows;
  return {
    headers,
    rows: lines.slice(1, maxRows + 1).map((l) => splitLine(l, sep)),
    rowCount,
    mapping,
    missingRequired: ["fromAccount", "toAccount", "amount"].filter((f) => !mapping[f]),
  };
};
