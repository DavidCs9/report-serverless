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
    // Drop report_jobs table
    await connection.execute("DROP TABLE IF EXISTS report_jobs;");
    logger.info("report_jobs table dropped (if it existed).");

    // Create report_jobs table
    logger.info("Creating report_jobs table...");
    await connection.execute(`
      CREATE TABLE report_jobs (
            job_id VARCHAR(255) PRIMARY KEY,
            status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL,
            s3_url VARCHAR(1024) NULL,
            error_message TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
    `);
    logger.info("Successfully created report_jobs table");

    // Drop silo_hourly_aggregates table
    logger.info("Dropping silo_hourly_aggregates table if it exists...");
    await connection.execute("DROP TABLE IF EXISTS silo_hourly_aggregates;");
    logger.info("silo_hourly_aggregates table dropped (if it existed).");

    // Create silo_hourly_aggregates table
    logger.info("Creating silo_hourly_aggregates table...");
    await connection.execute(`
      CREATE TABLE silo_hourly_aggregates (
            silo_id INT NOT NULL,
            hour_timestamp TIMESTAMP NOT NULL, -- e.g., 2025-05-19 14:00:00
            avg_value DECIMAL(10, 2),
            min_value DECIMAL(10, 2),
            max_value DECIMAL(10, 2),
            sum_value DECIMAL(10, 2),
            record_count INT,
            PRIMARY KEY (silo_id, hour_timestamp)
        );`); // Note: The trailing comma was removed in the previous suggestion
    logger.info("Successfully created silo_hourly_aggregates table");

    // Add any additional tables here as needed
    logger.info("Creating silo_raw_data table...");
    await connection.execute("DROP TABLE IF EXISTS silo_raw_data;");
    logger.info("silo_raw_data table dropped (if it existed).");
    await connection.execute(`
      CREATE TABLE silo_raw_data (
            silo_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- e.g., 2025-05-19 14:01:32
            value DECIMAL(10, 2),
            PRIMARY KEY (silo_id, timestamp)
        );`);
    logger.info("Successfully created silo_raw_data table");
    logger.info("Database setup completed successfully");
  } catch (error) {
    logger.error("Error creating tables:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
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
