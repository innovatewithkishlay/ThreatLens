const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true },
    name: { type: String, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    owner: {
      kind: { type: String, enum: ["user", "guest"], required: true },
      id: { type: String, required: true },
    },
    sourceFile: String,
    status: {
      type: String,
      enum: ["open", "investigating", "escalated", "closed"],
      default: "open",
    },
    notes: { type: String, maxlength: 10000, default: "" },
    stats: {
      transactionCount: Number,
      accountCount: Number,
      totalVolume: Number,
      averageAmount: Number,
      maxAmount: Number,
      currency: String,
      dateRange: { start: Date, end: Date },
      skippedRows: Number,
      flaggedTransactions: Number,
    },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: "low" },
    // Full detection output (findings, network, account risk, summary).
    analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    warnings: [String],
    // Per-case detection settings (overrides of config/thresholds.js).
    thresholds: { type: mongoose.Schema.Types.Mixed, default: null },
    reportDraft: { type: String, maxlength: 50000, default: "" },
    checklist: {
      type: [
        {
          _id: false,
          key: String,
          text: { type: String, maxlength: 300 },
          done: { type: Boolean, default: false },
          auto: { type: Boolean, default: false },
          doneAt: Date,
        },
      ],
      default: [],
    },
    analyzedAt: Date,
  },
  { timestamps: true, minimize: false }
);

caseSchema.index({ "owner.kind": 1, "owner.id": 1, createdAt: -1 });

module.exports = mongoose.model("Case", caseSchema);
