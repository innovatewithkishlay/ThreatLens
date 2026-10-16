const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  row: Number,
  reference: String,
  fromAccount: { type: String, required: true },
  toAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: String,
  date: Date,
  description: String,
  country: String,
  isSuspicious: { type: Boolean, default: false },
  flags: [String],
  reviewStatus: {
    type: String,
    enum: ["unreviewed", "suspicious", "cleared"],
    default: "unreviewed",
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
