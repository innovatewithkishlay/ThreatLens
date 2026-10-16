const mongoose = require("mongoose");

const watchlistEntrySchema = new mongoose.Schema(
  {
    owner: {
      kind: { type: String, enum: ["user", "guest"], required: true },
      id: { type: String, required: true },
    },
    type: { type: String, enum: ["account", "name", "email", "phone", "ip"], required: true },
    value: { type: String, required: true, trim: true, maxlength: 200 },
    normalized: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    source: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

watchlistEntrySchema.index({ "owner.kind": 1, "owner.id": 1, type: 1, normalized: 1 }, { unique: true });

module.exports = mongoose.model("WatchlistEntry", watchlistEntrySchema);
