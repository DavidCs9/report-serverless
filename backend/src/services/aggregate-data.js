const db = require("./database");
const winston = require("winston");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

const siloIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

async function getRawDataPerSilo(siloId) {
  const query = `
    SELECT silo_id, value
    FROM silo_raw_data
    WHERE silo_id = ${siloId}
    AND timestamp >= NOW() - INTERVAL 1 HOUR
  `;
  const result = await db.executeQuery(query);
  return result;
}

async function aggregateData() {
  for (const siloId of siloIds) {
    const rawData = await getRawDataPerSilo(siloId);
    rawData.forEach((item) => {
      item.value = parseFloat(item.value);
    });
    const avgValue =
      rawData.reduce((acc, curr) => acc + curr.value, 0) / rawData.length;
    const minValue = Math.min(...rawData.map((item) => item.value));
    const maxValue = Math.max(...rawData.map((item) => item.value));
    const sumValue = rawData.reduce((acc, curr) => acc + curr.value, 0);
    const recordCount = rawData.length;

    const query = `
        INSERT INTO silo_hourly_aggregates (silo_id, hour_timestamp, avg_value, min_value, max_value, sum_value, record_count)
        VALUES (${siloId}, NOW(), ${avgValue}, ${minValue}, ${maxValue}, ${sumValue}, ${recordCount})
      `;
    await db.executeQuery(query);
  }
}

module.exports = aggregateData;
