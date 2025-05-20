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
    // put status to processing
    await updateReportStatus(jobId, "PROCESSING", null);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Silo Report");
    worksheet.addRow([
      "Silo ID",
      "Timestamp",
      "Average Value",
      "Min Value",
      "Max Value",
      "Sum Value",
      "Record Count",
    ]);

    const siloIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    for (const siloId of siloIds) {
      const data = await getSiloData(siloId);
      worksheet.addRow([
        siloId,
        data.timestamp,
        data.averageValue,
        data.minValue,
        data.maxValue,
        data.sumValue,
        data.recordCount,
      ]);
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

    // mock delay
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds

    // put status to completed
    await updateReportStatus(jobId, "COMPLETED", s3Url);
  } catch (error) {
    await updateReportStatus(jobId, "FAILED", null);
    logger.error(`Error generating Excel report: ${error}`);
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
