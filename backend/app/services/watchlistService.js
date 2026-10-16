const mongoose = require("mongoose");
const WatchlistEntry = require("../models/WatchlistEntry");
const { normaliseValue } = require("../utils/screening");

const TYPES = ["account", "name", "email", "phone", "ip"];
const httpError = (status, message) => Object.assign(new Error(message), { status });
const ownerFilter = (owner) => ({ "owner.kind": owner.kind, "owner.id": owner.id });

// Guess the entry type when importing a plain list.
const inferType = (value) => {
  const v = value.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "email";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-f:]+:[0-9a-f:]+$/i.test(v)) return "ip";
  if (/^\+?[\d\s().-]{7,}$/.test(v) && v.replace(/\D/g, "").length >= 7) return "phone";
  if (/^[A-Z0-9-]{4,}$/i.test(v) && /\d/.test(v) && !/\s/.test(v)) return "account";
  return "name";
};

const list = (owner) => WatchlistEntry.find(ownerFilter(owner), { owner: 0, normalized: 0, __v: 0 }).sort({ createdAt: -1 }).lean();

const add = async (owner, entries) => {
  if (!Array.isArray(entries) || !entries.length) throw httpError(400, "Provide at least one watchlist entry.");
  if (entries.length > 5000) throw httpError(400, "You can import at most 5,000 entries at once.");
  let added = 0;
  let skipped = 0;
  const ops = [];
  for (const raw of entries) {
    const value = String(raw?.value || "").trim().slice(0, 200);
    if (!value) {
      skipped++;
      continue;
    }
    const type = TYPES.includes(raw.type) ? raw.type : inferType(value);
    const normalized = normaliseValue(type, value);
    if (!normalized) {
      skipped++;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { ...ownerFilter(owner), type, normalized },
        update: {
          $setOnInsert: { owner, type, normalized, value },
          $set: { ...(raw.note ? { note: String(raw.note).slice(0, 300) } : {}), ...(raw.source ? { source: String(raw.source).slice(0, 80) } : {}) },
        },
        upsert: true,
      },
    });
  }
  if (ops.length) {
    const res = await WatchlistEntry.bulkWrite(ops, { ordered: false });
    added = res.upsertedCount || 0;
    skipped += ops.length - added;
  }
  return { added, skipped };
};

const remove = async (owner, id) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Entry not found.");
  const res = await WatchlistEntry.deleteOne({ _id: id, ...ownerFilter(owner) });
  if (!res.deletedCount) throw httpError(404, "Entry not found.");
};

const clear = (owner) => WatchlistEntry.deleteMany(ownerFilter(owner));

module.exports = { list, add, remove, clear, inferType, TYPES };
