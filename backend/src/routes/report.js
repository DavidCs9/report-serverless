const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const reportService = require("../services/report");

// POST /api/initiate-silo-report
router.post("/initiate-silo-report", async (req, res, next) => {
  try {
    const jobId = uuidv4();
    await reportService.initiateReport(jobId);
    res.json({ jobId, status: "PENDING" });
  } catch (error) {
    next(error);
  }
});

// GET /api/silo-report-status/:jobId
router.get("/silo-report-status/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const reportStatus = await reportService.getReportStatus(jobId);

    if (!reportStatus) {
      return res.status(404).json({ error: "Report job not found" });
    }

    res.json(reportStatus);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
