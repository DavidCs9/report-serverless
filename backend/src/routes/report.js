const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const reportService = require("../services/report");

// POST /api/initiate-silo-report
router.post("/initiate-silo-report", async (req, res, next) => {
  try {
    const jobId = uuidv4();
    const result = await reportService.initiateReport(jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
