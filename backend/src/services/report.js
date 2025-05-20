const AWS = require("aws-sdk");
const mysql = require("mysql2/promise");
const winston = require("winston");

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

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

// Create database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

class ReportService {
  async initiateReport(jobId) {
    const connection = await pool.getConnection();
    try {
      // Start transaction
      await connection.beginTransaction();

      // Insert new report job
      await connection.execute(
        "INSERT INTO report_jobs (job_id, status) VALUES (?, ?)",
        [jobId, "PENDING"]
      );

      // Commit transaction
      await connection.commit();

      // Invoke Lambda asynchronously
      const params = {
        FunctionName: process.env.REPORT_GENERATOR_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({ jobId }),
      };

      await lambda.invoke(params).promise();
      logger.info(`Report generation initiated for job ${jobId}`);
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      logger.error(`Error initiating report for job ${jobId}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async getReportStatus(jobId) {
    try {
      const [rows] = await pool.execute(
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
