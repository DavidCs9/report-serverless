const winston = require("winston");
const db = require("./database");
const generateExcelReport = require("./excel");

const lambda = new AWS.Lambda();
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/report-service.log" }),
  ],
});

class ReportService {
  async initiateReport(jobId) {
    try {
      await db.executeTransaction(async (connection) => {
        // Insert new report job
        await connection.execute(
          "INSERT INTO report_jobs (job_id, status) VALUES (?, ?)",
          [jobId, "PENDING"]
        );
      });

      await generateExcelReport(jobId);

      //mock lambda invocation
      setTimeout(() => {
        logger.info(`Report generation initiated for job ${jobId}`);
      }, 1000);
    } catch (error) {
      logger.error(`Error initiating report for job ${jobId}:`, error);
      throw error;
    }
  }

  async getReportStatus(jobId) {
    try {
      const rows = await db.executeQuery(
        "SELECT job_id, status, s3_url, error_message, created_at, updated_at FROM report_jobs WHERE job_id = ?",
        [jobId]
      );

      if (rows.length === 0) {
        return null;
      }

      const job = rows[0];
      return {
        jobId: job.job_id,
        status: job.status,
        s3Url: job.s3_url,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    } catch (error) {
      logger.error(`Error getting report status for job ${jobId}:`, error);
      throw error;
    }
  }
}

module.exports = new ReportService();
