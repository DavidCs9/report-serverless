require("dotenv").config();
const mysql = require("mysql2/promise");
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/db-setup.log" }),
  ],
});

async function createTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Create report_jobs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS report_jobs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        job_id VARCHAR(36) NOT NULL UNIQUE,
        status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL,
        s3_url VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_job_id (job_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    logger.info("Successfully created report_jobs table");

    // Add any additional tables here as needed

    logger.info("Database setup completed successfully");
  } catch (error) {
    logger.error("Error creating tables:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
createTables()
  .then(() => {
    logger.info("Database setup completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Database setup failed:", error);
    process.exit(1);
  });
