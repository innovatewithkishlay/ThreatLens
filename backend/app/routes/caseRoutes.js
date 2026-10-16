const express = require("express");
const upload = require("../../config/upload");
const { uploadLimiter } = require("../../config/security");
const c = require("../controllers/caseController");

const router = express.Router();

router.get("/", c.listCases);
router.post("/", uploadLimiter, upload.single("csvFile"), c.uploadCase);
router.post("/pair", uploadLimiter, upload.array("csvFiles", 2), c.uploadPair);
router.post("/compare", c.compareCases);
router.get("/compare/:a/:b", c.compareCases);
router.get("/:id", c.getCase);
router.post("/:id/reanalyze", c.reanalyze);
router.get("/:id/trace", c.trace);
router.get("/:id/report", c.report);
router.get("/:id/links", c.links);
router.patch("/:id", c.updateCase);
router.delete("/:id", c.deleteCase);
router.get("/:id/transactions", c.getTransactions);
router.get("/:id/export", c.exportCase);
router.patch("/:id/transactions/:txId", c.reviewTransaction);

module.exports = router;
