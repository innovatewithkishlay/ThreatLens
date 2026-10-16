const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
  accountNumber: { type: String, required: true },
  accountHolder: String,
  accountType: String,
  openedAt: Date,
  country: String,
  metadata: {
    email: String,
    mobile: String,
    ipAddress: String,
  },
  stats: {
    inflow: { type: Number, default: 0 },
    outflow: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
  },
  riskScore: { type: Number, default: 0 },
  riskLevel: { type: String, default: "low" },
  reasons: [String],
});

accountSchema.index({ caseId: 1, accountNumber: 1 }, { unique: true });

module.exports = mongoose.model("Account", accountSchema);
