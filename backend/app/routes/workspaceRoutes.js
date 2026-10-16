const crypto = require("crypto");
const express = require("express");
const Case = require("../models/Case");
const WatchlistEntry = require("../models/WatchlistEntry");
const { setWorkspace, KEY_PATTERN } = require("../middlewares/identify");

const router = express.Router();

const summary = async (key) => {
  const owner = { "owner.kind": "guest", "owner.id": key };
  const [cases, watchlist] = await Promise.all([Case.countDocuments(owner), WatchlistEntry.countDocuments(owner)]);
  return { key, cases, watchlist };
};

router.get("/", async (req, res) => {
  res.json(await summary(req.workspace));
});

// Open an existing workspace with its key (another device or a teammate).
router.post("/join", async (req, res) => {
  const key = String(req.body?.key || "").trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) {
    return res.status(400).json({ error: "That doesn't look like a valid workspace key." });
  }
  setWorkspace(res, key);
  res.json(await summary(key));
});

// Start over with an empty workspace. The old one stays available via its key.
router.post("/new", async (req, res) => {
  const key = crypto.randomUUID();
  setWorkspace(res, key);
  res.json(await summary(key));
});

module.exports = router;
