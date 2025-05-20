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
    new winston.transports.File({ filename: "logs/mock-data-population.log" }),
  ],
});

// Configuration
const NUM_SILOS = 5; // Number of silos to generate data for
const START_DATE = new Date("2024-03-01T00:00:00Z"); // Start date for the data
const END_DATE = new Date("2024-03-31T23:00:00Z"); // End date for the data

// Helper function to generate a random value within a range
function getRandomValue(min, max) {
  return Math.random() * (max - min) + min;
}

// Helper function to generate mock data for a single hour
function generateHourlyData(siloId, timestamp) {
  const baseValue = getRandomValue(50, 150); // Base value for the silo
  const variation = getRandomValue(-10, 10); // Random variation
  const value = baseValue + variation;

  return {
    silo_id: siloId,
    hour_timestamp: timestamp,
    avg_value: value,
    min_value: value - getRandomValue(0, 5),
    max_value: value + getRandomValue(0, 5),
    sum_value: value * getRandomValue(80, 120), // Simulate multiple readings
    record_count: Math.floor(getRandomValue(80, 120)),
  };
}

async function populateMockData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Clear existing data
    await connection.execute("TRUNCATE TABLE silo_hourly_aggregates;");
    logger.info("Cleared existing data from silo_hourly_aggregates table");

    const batchSize = 100;
    let batch = [];

    // Generate data for all silos and timestamps
    for (let siloId = 1; siloId <= NUM_SILOS; siloId++) {
      const currentDate = new Date(START_DATE);

      while (currentDate <= END_DATE) {
        const hourlyData = generateHourlyData(siloId, new Date(currentDate));
        batch.push(hourlyData);

        if (batch.length >= batchSize) {
          await insertBatch(connection, batch);
          batch = [];
        }

        // Move to next hour
        currentDate.setHours(currentDate.getHours() + 1);
      }
    }

    // Insert any remaining records
    if (batch.length > 0) {
      await insertBatch(connection, batch);
    }

    logger.info("Successfully populated mock data");
  } catch (error) {
    logger.error("Error populating mock data:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function insertBatch(connection, batch) {
  const values = batch.map((data) => [
    data.silo_id,
    data.hour_timestamp,
    data.avg_value,
    data.min_value,
    data.max_value,
    data.sum_value,
    data.record_count,
  ]);

  const query = `
    INSERT INTO silo_hourly_aggregates 
    (silo_id, hour_timestamp, avg_value, min_value, max_value, sum_value, record_count)
    VALUES ?
  `;

  await connection.query(query, [values]);
}

// Run the script
populateMockData()
  .then(() => {
    logger.info("Mock data population completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Mock data population failed:", error);
    process.exit(1);
  });
