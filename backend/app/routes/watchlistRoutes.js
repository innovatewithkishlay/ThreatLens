const express = require("express");
const watchlist = require("../services/watchlistService");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json(await watchlist.list(req.owner));
});

router.post("/", async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [req.body];
  res.status(201).json(await watchlist.add(req.owner, entries));
});

router.delete("/", async (req, res) => {
  await watchlist.clear(req.owner);
  res.status(204).end();
});

router.delete("/:id", async (req, res) => {
  await watchlist.remove(req.owner, req.params.id);
  res.status(204).end();
});

module.exports = router;
