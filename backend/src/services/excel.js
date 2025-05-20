const ExcelJS = require("exceljs");
const AWS = require("aws-sdk");
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
    new winston.transports.File({ filename: "logs/excel.log" }),
  ],
});

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function generateExcelReport(jobId) {
  try {
    console.time("generateExcelReport");
    // put status to processing
    await updateReportStatus(jobId, "PROCESSING", null);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Silo Report");
    worksheet.addRow([
      "Silo ID",
      "Hourly Timestamp",
      "Average Value",
      "Min Value",
      "Max Value",
      "Sum Value",
      "Record Count",
    ]);

    const siloIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    for (const siloId of siloIds) {
      const data = await getSiloData(siloId);
      for (const row of data) {
        const hourlyTimestamp = new Date(row.hour_timestamp).toLocaleString(
          "en-US",
          {
            timeZone: "America/New_York",
          }
        );

        worksheet.addRow([
          row.silo_id,
          hourlyTimestamp,
          row.avg_value,
          row.min_value,
          row.max_value,
          row.sum_value,
          row.record_count,
        ]);
      }
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // update to s3
    const s3 = new AWS.S3();
    const s3Params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${jobId}.xlsx`,
      Body: excelBuffer,
    };
    await s3.putObject(s3Params).promise();
    const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${jobId}.xlsx`;

    // put status to completed
    await updateReportStatus(jobId, "COMPLETED", s3Url);
  } catch (error) {
    await updateReportStatus(jobId, "FAILED", null);
    logger.error(`Error generating Excel report: ${error}`);
  } finally {
    console.timeEnd("generateExcelReport");
  }
}

async function getSiloData(siloId) {
  const query = `
    SELECT * FROM silo_hourly_aggregates
    WHERE silo_id = ${siloId}
  `;
  const data = await db.executeQuery(query);
  return data;
}

async function updateReportStatus(jobId, status, s3Url) {
  const query = `
    UPDATE report_jobs SET status = '${status}', s3_url = '${s3Url}' WHERE job_id = '${jobId}'
  `;
  await db.executeQuery(query);
}

module.exports = generateExcelReport;
