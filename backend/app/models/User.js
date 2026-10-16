const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, unique: true, sparse: true },
    email: String,
    name: String,
    avatar: String,
    role: { type: String, default: "user" },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
