const Case = require("../models/Case");
const ANOMALY_THRESHOLDS = require("../../config/thresholds");

const findCommonMetadata = (case1, case2, field) => {
  const accounts1 = case1.accounts.map((a) => ({
    accountNumber: a.accountNumber,
    value: a.metadata?.[field],
  }));
  const accounts2 = case2.accounts.map((a) => ({
    accountNumber: a.accountNumber,
    value: a.metadata?.[field],
  }));

  const shared = [];
  for (const acc1 of accounts1) {
    for (const acc2 of accounts2) {
      if (
        acc1.accountNumber === acc2.accountNumber &&
        acc1.value &&
        acc2.value &&
        acc1.value === acc2.value
      ) {
        shared.push(acc1.value);
      }
    }
  }
  return [...new Set(shared)];
};

const compareCircularPatterns = (circular1, circular2) => {
  const paths1 = circular1.map((c) => c.path.join("-"));
  const paths2 = circular2.map((c) => c.path.join("-"));
  return (
    paths1.filter((p) => paths2.includes(p)).length / Math.max(paths1.length, 1)
  );
};

const timeDifference = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2 - d1);
  return `${Math.floor(diffMs / 3600000)}h ${Math.floor(
    (diffMs % 3600000) / 60000
  )}m`;
};
const getOverlappingPeriod = (datesA, datesB) => {
  if (!datesA.length || !datesB.length) return null;

  const minA = new Date(Math.min(...datesA.map((d) => new Date(d).getTime())));
  const maxA = new Date(Math.max(...datesA.map((d) => new Date(d).getTime())));
  const minB = new Date(Math.min(...datesB.map((d) => new Date(d).getTime())));
  const maxB = new Date(Math.max(...datesB.map((d) => new Date(d).getTime())));

  if (minA > maxB || minB > maxA) return null;

  const overlapStart = new Date(Math.max(minA.getTime(), minB.getTime()));
  const overlapEnd = new Date(Math.min(maxA.getTime(), maxB.getTime()));

  return `${overlapStart.toISOString().split("T")[0]} to ${
    overlapEnd.toISOString().split("T")[0]
  }`;
};
const findCommonCountries = (case1, case2) => {
  const countries1 = case1.anomalies.geographic.map((g) => g.country) || [];
  const countries2 = case2.anomalies.geographic.map((g) => g.country) || [];
  return [...new Set(countries1.filter((c) => countries2.includes(c)))];
};
const findNewHighRiskCountries = (case1, case2) => {
  const countries1 = case1.anomalies.geographic.map((g) => g.country) || [];
  const countries2 = case2.anomalies.geographic.map((g) => g.country) || [];
  return [
    ...new Set(
      countries2.filter(
        (c) =>
          !countries1.includes(c) &&
          ANOMALY_THRESHOLDS.HIGH_RISK_COUNTRIES.includes(c)
      )
    ),
  ];
};
const compareCases = async (caseId1, caseId2) => {
  const [case1, case2] = await Promise.all([
    Case.findById(caseId1).populate("accounts transactions").lean(),
    Case.findById(caseId2).populate("accounts transactions").lean(),
  ]);

  return {
    directLinks: await findDirectLinks(case1, case2),
    patternSimilarity: calculatePatternSimilarity(case1, case2),
    networkAnalysis: performNetworkAnalysis(case1, case2),
    riskAssessment: assessCombinedRisk(case1, case2),
    temporalAnalysis: compareTemporalPatterns(case1, case2),
    geographicAnalysis: compareGeographicData(case1, case2),
  };
};

const findDirectLinks = async (case1, case2) => {
  const case1Accounts = new Set(case1.accounts.map((a) => a.accountNumber));
  const case2Accounts = new Set(case2.accounts.map((a) => a.accountNumber));

  const sharedAccounts = [...case1Accounts].filter((acc) =>
    case2Accounts.has(acc)
  );
  const sharedMetadata = {
    emails: findCommonMetadata(case1, case2, "email"),
    phones: findCommonMetadata(case1, case2, "mobile"),
    ips: findCommonMetadata(case1, case2, "ipAddress"),
  };

  const transactionLinks = case1.transactions.reduce((links, t1) => {
    case2.transactions.forEach((t2) => {
      if (t1.toAccount === t2.fromAccount) {
        links.push({
          path: [t1.fromAccount, t1.toAccount, t2.toAccount],
          totalAmount: t1.amount + t2.amount,
          transactions: [t1._id, t2._id],
          timeGap: timeDifference(t1.date, t2.date),
        });
      }
    });
    return links;
  }, []);

  return { sharedAccounts, sharedMetadata, transactionLinks };
};

const calculatePatternSimilarity = (case1, case2) => ({
  highValue: cosineSimilarity(
    case1.anomalies.highValue.map((hv) => hv.amount),
    case2.anomalies.highValue.map((hv) => hv.amount)
  ),
  structuring: cosineSimilarity(
    case1.anomalies.structuring.map((s) => s.count),
    case2.anomalies.structuring.map((s) => s.count)
  ),
  circular: compareCircularPatterns(
    case1.anomalies.circular,
    case2.anomalies.circular
  ),
});

const performNetworkAnalysis = (case1, case2) => {
  const allNodes = [
    ...case1.anomalies.network.nodes,
    ...case2.anomalies.network.nodes,
  ];
  const allEdges = [
    ...case1.anomalies.network.edges,
    ...case2.anomalies.network.edges,
  ];

  const connectorAccounts = allNodes.filter(
    (node) =>
      allEdges.filter((e) => e.from === node.account || e.to === node.account)
        .length > 10
  );

  const bridgeEdges = allEdges.filter(
    (edge) =>
      case1.accounts.some((a) => a.accountNumber === edge.from) &&
      case2.accounts.some((a) => a.accountNumber === edge.to)
  );

  return { connectorAccounts, bridgeEdges };
};

const assessCombinedRisk = (case1, case2) => {
  const getCountries = (caseData) => [
    ...new Set(
      caseData.transactions
        .map((t) => t.metadata?.ipCountry)
        .filter((c) => c !== undefined)
    ),
  ];

  const case1Countries = getCountries(case1);
  const case2Countries = getCountries(case2);

  const riskFactors = {
    sharedAccounts:
      case1.accounts.filter((a) =>
        case2.accounts.some((a2) => a2.accountNumber === a.accountNumber)
      ).length * 15,

    highValueOverlap:
      case1.anomalies.highValue.filter((hv1) =>
        case2.anomalies.highValue.some(
          (hv2) =>
            Math.abs(hv2.amount - hv1.amount) <=
            0.2 * Math.max(hv1.amount, hv2.amount)
        )
      ).length * 20,

    geographicRisk:
      [...new Set([...case1Countries, ...case2Countries])].filter((c) =>
        ANOMALY_THRESHOLDS.HIGH_RISK_COUNTRIES.includes(c)
      ).length * 25,
  };

  const totalRisk = Object.values(riskFactors).reduce(
    (sum, val) => sum + val,
    0
  );

  return {
    riskFactors,
    totalRisk,
    riskLevel:
      totalRisk > 200
        ? "CRITICAL"
        : totalRisk > 100
        ? "HIGH"
        : totalRisk > 50
        ? "MEDIUM"
        : "LOW",
  };
};

const compareTemporalPatterns = (case1, case2) => {
  const case1Hours = getHourlyDistribution(case1.transactions);
  const case2Hours = getHourlyDistribution(case2.transactions);

  return {
    similarity: cosineSimilarity(case1Hours, case2Hours),
    overlap: getOverlappingPeriod(
      case1.transactions.map((t) => t.date),
      case2.transactions.map((t) => t.date)
    ),
  };
};

const getTransactionCountries = (caseData) => [
  ...new Set(
    caseData.transactions
      .map((t) => t.metadata?.ipCountry)
      .filter((c) => c !== undefined)
  ),
];

const compareGeographicData = (case1, case2) => {
  const case1Countries = getTransactionCountries(case1);
  const case2Countries = getTransactionCountries(case2);

  return {
    commonCountries: [
      ...new Set(case1Countries.filter((c) => case2Countries.includes(c))),
    ],
    newHighRisk: [
      ...new Set(
        case2Countries.filter(
          (c) =>
            !case1Countries.includes(c) &&
            ANOMALY_THRESHOLDS.HIGH_RISK_COUNTRIES.includes(c)
        )
      ),
    ],
  };
};

const cosineSimilarity = (a, b) => {
  if (a.length === 0 || b.length === 0) return 0;

  if (a.length === 1 && b.length === 1) {
    return Math.abs(a[0] - b[0]) <= 0.2 * Math.max(a[0], b[0]) ? 1 : 0;
  }

  const maxAmount = Math.max(...a, ...b);
  const vecA = a.map((x) => x / maxAmount);
  const vecB = b.map((x) => (b.includes(x) ? x : 0) / maxAmount);

  const dotProduct = vecA.reduce(
    (sum, val, i) => sum + val * (vecB[i] || 0),
    0
  );
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val ** 2, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val ** 2, 0));

  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
};

const getHourlyDistribution = (transactions) => {
  const distribution = Array(24).fill(0);
  transactions.forEach((t) => {
    const hour = new Date(t.date).getHours();
    distribution[hour]++;
  });
  return distribution;
};

module.exports = { compareCases };
