/**
 * Drafts a Suspicious Activity Report (SAR/STR) narrative from a case's
 * analysis. The structure follows the common "who, what, when, where, why,
 * how" guidance used by financial intelligence units. The output is a draft
 * for an investigator to review and edit - never filed automatically.
 */

const fmtMoney = (n, currency) => {
  const v = Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return currency ? `${currency} ${v}` : v;
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : "an unknown date";
const list = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const plural = (n, w, p = `${w}s`) => `${n} ${n === 1 ? w : p}`;

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Investigation tasks implied by the findings. Keys are stable so a case's
 * checklist can be re-generated without losing what was already ticked off.
 */
const buildChecklist = (analysis = {}) => {
  const findings = analysis.findings || [];
  const has = (...types) => findings.some((f) => types.includes(f.type));
  const subjectsOf = (...types) => [...new Set(findings.filter((f) => types.includes(f.type)).flatMap((f) => f.subjects))].slice(0, 6).join(", ");
  const items = [];
  const add = (key, text) => items.push({ key, text });
  if (has("watchlist")) add("watchlist", `Confirm or discount watchlist matches (${subjectsOf("watchlist")}) and escalate true hits immediately.`);
  if (has("circular", "passThrough")) add("ubo", `Obtain beneficial ownership information for accounts in circular / pass-through chains (${subjectsOf("circular", "passThrough")}).`);
  if (has("structuring")) add("sof", `Request source-of-funds evidence for near-threshold transfers by ${subjectsOf("structuring")}.`);
  if (has("sharedIdentity")) add("kyc", `Re-verify identity documents for accounts sharing contact or device details (${subjectsOf("sharedIdentity")}).`);
  if (has("highRiskGeo") || (analysis.geography || []).some((g) => g.highRisk)) add("edd", "Apply enhanced due diligence to activity linked to high-risk jurisdictions.");
  if (has("fanIn", "fanOut")) add("mules", `Review onboarding of the many small counterparties around ${subjectsOf("fanIn", "fanOut")} for possible money-mule recruitment.`);
  if (has("dormant")) add("dormant", `Contact the owners of reactivated dormant accounts (${subjectsOf("dormant")}) to rule out account takeover.`);
  if (has("newAccount")) add("newacct", `Review onboarding documents and expected activity for new accounts (${subjectsOf("newAccount")}).`);
  if (has("outlier", "highValue")) add("purpose", `Obtain the economic purpose of unusually large transfers (${subjectsOf("outlier", "highValue")}).`);
  if (has("benford")) add("benford", "Sample-test the amounts flagged by the Benford analysis against invoices or contracts.");
  if (findings.length) {
    add("trace", "Trace funds from the highest-risk accounts to identify where the money ended up.");
    add("restrict", "Decide whether to restrict outgoing payments on the highest-risk accounts pending review.");
    add("sar", "Review the generated SAR draft and file it or document the decision not to file.");
  } else {
    add("close", "Document the review and close the case if no further concerns arise.");
  }
  return items;
};

const buildReport = (caseDoc, accounts = []) => {
  const a = caseDoc.analysis || {};
  const stats = caseDoc.stats || {};
  const cur = stats.currency;
  const findings = [...(a.findings || [])].sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
  const accountInfo = new Map(accounts.map((x) => [x.accountNumber, x]));
  const risk = a.accountRisk || [];

  const subjects = risk.filter((r) => r.score >= 50).slice(0, 10);
  const subjectList = (subjects.length ? subjects : risk.slice(0, 3)).map((r) => {
    const info = accountInfo.get(r.account) || {};
    return {
      account: r.account,
      holder: r.holder || info.accountHolder || "Unknown holder",
      type: info.accountType || r.type,
      country: info.country || r.country,
      email: info.metadata?.email,
      phone: info.metadata?.mobile,
      ip: info.metadata?.ipAddress,
      inflow: r.inflow,
      outflow: r.outflow,
      score: r.score,
      reasons: r.reasons,
    };
  });

  const typologies = [...new Set(findings.map((f) => f.label))];
  const flaggedVolume = findings.reduce((s, f) => s + (f.amount || 0), 0);
  const range = stats.dateRange;
  const highRisk = (a.geography || []).filter((g) => g.highRisk).map((g) => g.country);

  const who = subjectList.length
    ? `This report concerns ${plural(subjectList.length, "account")} identified as the primary subjects of case ${caseDoc.caseId}: ` +
      subjectList
        .map((s) => {
          const ids = [s.email && `email ${s.email}`, s.phone && `phone ${s.phone}`, s.ip && `IP address ${s.ip}`].filter(Boolean);
          return `${s.holder} (account ${s.account}${s.type ? `, ${s.type}` : ""}${s.country ? `, ${s.country}` : ""}${ids.length ? `; ${ids.join(", ")}` : ""})`;
        })
        .join("; ") +
      "."
    : "No individual subject reached the reporting risk threshold.";

  const what =
    `Between ${fmtDate(range?.start)} and ${fmtDate(range?.end)}, ${plural(stats.transactionCount || 0, "transfer")} totalling ${fmtMoney(stats.totalVolume, cur)} ` +
    `were reviewed across ${plural(stats.accountCount || 0, "account")}. Automated analysis raised ${plural(findings.length, "finding")} ` +
    `(${a.summary?.severity?.critical || 0} critical, ${a.summary?.severity?.high || 0} high) involving ${plural(stats.flaggedTransactions || 0, "transfer")}` +
    (typologies.length ? `, consistent with the following typologies: ${list(typologies.map((t) => t.toLowerCase()))}.` : ".");

  const where = highRisk.length
    ? `Activity was linked to ${plural(highRisk.length, "jurisdiction")} under increased monitoring (${highRisk.join(", ")}), in addition to ${plural(
        Math.max(0, (a.geography || []).length - highRisk.length),
        "other country",
        "other countries"
      )}.`
    : (a.geography || []).length
    ? `Activity originated from ${list((a.geography || []).slice(0, 8).map((g) => g.country))}. No high-risk jurisdictions were identified.`
    : "Geographic origin was not available in the source data.";

  const how = findings.slice(0, 12).map((f) => `${f.title}. ${f.description} (${plural(f.transactions.length, "transfer")}, ${fmtMoney(f.amount, cur)}).`);

  const why =
    `The combination of these indicators produced an overall case risk score of ${caseDoc.riskScore}/100 (${String(caseDoc.riskLevel).toUpperCase()}). ` +
    (subjectList.some((s) => s.score >= 75)
      ? "At least one account exhibits multiple independent red flags, which is not explained by ordinary commercial activity."
      : "The pattern of activity warrants further review to establish a legitimate economic purpose.");

  const actions = buildChecklist(a).map((x) => x.text);

  const sections = [
    {
      key: "summary",
      title: "Summary",
      body:
        `Case ${caseDoc.caseId} is assessed as ${String(caseDoc.riskLevel).toUpperCase()} risk (${caseDoc.riskScore}/100). ` +
        (findings.length
          ? `${plural(findings.length, "red flag")} were identified, led by ${list(typologies.slice(0, 3).map((t) => t.toLowerCase()))}, ` +
            `involving ${plural(stats.flaggedTransactions || 0, "transfer")} and ${plural(subjectList.length, "primary subject")}.`
          : "No red flags were identified by automated analysis."),
    },
    { key: "who", title: "Subjects (who)", body: who },
    { key: "what", title: "Activity (what & when)", body: what },
    { key: "where", title: "Geography (where)", body: where },
    { key: "how", title: "Method (how)", body: how.length ? how.map((h, i) => `${i + 1}. ${h}`).join("\n") : "No suspicious method was identified." },
    { key: "why", title: "Grounds for suspicion (why)", body: why },
    { key: "actions", title: "Recommended actions", body: actions.map((x) => `- ${x}`).join("\n") },
  ];

  return {
    caseId: caseDoc.caseId,
    name: caseDoc.name,
    generatedAt: new Date().toISOString(),
    riskScore: caseDoc.riskScore,
    riskLevel: caseDoc.riskLevel,
    period: range ? { start: range.start, end: range.end } : null,
    totals: { transactions: stats.transactionCount, volume: stats.totalVolume, flaggedVolume: Math.round(flaggedVolume * 100) / 100, currency: cur },
    subjects: subjectList,
    typologies,
    sections,
    narrative: sections.map((s) => `${s.title.toUpperCase()}\n${s.body}`).join("\n\n"),
  };
};

module.exports = { buildReport, buildChecklist };
