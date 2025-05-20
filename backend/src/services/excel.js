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
    const startTime = new Date();
    await updateReportStatus(jobId, "PROCESSING", null);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Report Server";
    workbook.lastModifiedBy = "Report Server";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create styles
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const dataStyle = {
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const highlightStyle = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB9C" } },
    };

    // Dashboard Sheet
    const dashboardSheet = workbook.addWorksheet("Dashboard");
    dashboardSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // Summary Sheet
    const summarySheet = workbook.addWorksheet("Summary Statistics");
    summarySheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // Detailed Data Sheet
    const detailedSheet = workbook.addWorksheet("Detailed Data");
    detailedSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // Set up headers for detailed data
    const headers = [
      "Silo ID",
      "Hourly Timestamp",
      "Average Value",
      "Min Value",
      "Max Value",
      "Sum Value",
      "Record Count",
      "Standard Deviation",
      "Variance",
    ];

    // Collect all data for analysis
    const allData = [];
    const siloIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const siloStats = {};

    for (const siloId of siloIds) {
      const data = await getSiloData(siloId);
      allData.push(...data);

      // Calculate statistics for each silo
      const values = data.map((row) => row.avg_value);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const variance =
        values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      siloStats[siloId] = {
        avg,
        min,
        max,
        sum,
        count: values.length,
        stdDev,
        variance,
      };

      // Add data to detailed sheet
      for (const row of data) {
        const hourlyTimestamp = new Date(row.hour_timestamp).toLocaleString(
          "en-US",
          {
            timeZone: "America/New_York",
          }
        );

        detailedSheet.addRow([
          row.silo_id,
          hourlyTimestamp,
          row.avg_value,
          row.min_value,
          row.max_value,
          row.sum_value,
          row.record_count,
          stdDev,
          variance,
        ]);
      }
    }

    // Add summary statistics with enhanced formatting
    summarySheet.addRow(["Silo Statistics Summary"]);
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.addRow([
      "Silo ID",
      "Average",
      "Min",
      "Max",
      "Total Records",
      "Std Dev",
      "Variance",
      "Status",
    ]);
    summarySheet.getRow(2).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Calculate overall statistics for conditional formatting
    const allAverages = Object.values(siloStats).map((stats) => stats.avg);
    const overallAvg =
      allAverages.reduce((a, b) => a + b, 0) / allAverages.length;
    const maxAvg = Math.max(...allAverages);
    const minAvg = Math.min(...allAverages);

    Object.entries(siloStats).forEach(([siloId, stats], index) => {
      const row = summarySheet.addRow([
        siloId,
        stats.avg.toFixed(2),
        stats.min.toFixed(2),
        stats.max.toFixed(2),
        stats.count,
        stats.stdDev.toFixed(2),
        stats.variance.toFixed(2),
        stats.avg > overallAvg ? "Above Average" : "Below Average",
      ]);

      // Apply conditional formatting
      const avgCell = row.getCell(2);
      if (stats.avg > overallAvg) {
        avgCell.style = {
          ...dataStyle,
          font: { bold: true, color: { argb: "006100" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "C6EFCE" },
          },
        };
      } else {
        avgCell.style = {
          ...dataStyle,
          font: { bold: true, color: { argb: "9C0006" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC7CE" },
          },
        };
      }

      // Add data bars for visual comparison
      const statusCell = row.getCell(8);
      statusCell.style = {
        ...dataStyle,
        alignment: { horizontal: "center" },
      };
    });

    // Add dashboard content with enhanced visualization
    dashboardSheet.addRow(["Silo Report Dashboard"]);
    dashboardSheet.getRow(1).font = { bold: true, size: 16 };
    dashboardSheet.addRow(["Generated on: " + new Date().toLocaleString()]);
    dashboardSheet.addRow([]);

    // Add summary statistics
    dashboardSheet.addRow(["Quick Statistics"]);
    dashboardSheet.getRow(4).font = { bold: true, size: 14 };

    const statsHeaders = ["Metric", "Value", "Status"];
    dashboardSheet.addRow(statsHeaders);
    dashboardSheet.getRow(5).eachCell((cell) => {
      cell.style = headerStyle;
    });

    const totalRecords = allData.reduce(
      (sum, row) => sum + row.record_count,
      0
    );
    const allValues = allData.map((row) => row.avg_value);
    const highestValue = Math.max(...allValues);
    const lowestValue = Math.min(...allValues);

    // Add metrics with visual indicators
    const metrics = [
      ["Total Silos", siloIds.length, ""],
      ["Total Records", totalRecords.toLocaleString(), ""],
      [
        "Average Value",
        overallAvg.toFixed(2),
        overallAvg > (maxAvg + minAvg) / 2
          ? "Above Midpoint"
          : "Below Midpoint",
      ],
      ["Highest Value", highestValue.toFixed(2), "Maximum"],
      ["Lowest Value", lowestValue.toFixed(2), "Minimum"],
    ];

    metrics.forEach(([metric, value, status], index) => {
      const row = dashboardSheet.addRow([metric, value, status]);
      row.getCell(1).style = {
        ...dataStyle,
        alignment: { horizontal: "right" },
      };
      row.getCell(3).style = {
        ...dataStyle,
        alignment: { horizontal: "center" },
      };

      // Add conditional formatting for the average value
      if (metric === "Average Value") {
        const cell = row.getCell(2);
        cell.style = {
          ...dataStyle,
          font: { bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEB9C" },
          },
        };
      }
    });

    // Add detailed data with conditional formatting
    detailedSheet.addRow(headers);
    detailedSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Apply conditional formatting to the detailed data
    allData.forEach((row, index) => {
      const dataRow = detailedSheet.addRow([
        row.silo_id,
        new Date(row.hour_timestamp).toLocaleString("en-US", {
          timeZone: "America/New_York",
        }),
        row.avg_value,
        row.min_value,
        row.max_value,
        row.sum_value,
        row.record_count,
        siloStats[row.silo_id].stdDev,
        siloStats[row.silo_id].variance,
      ]);

      // Apply conditional formatting to the average value
      const avgCell = dataRow.getCell(3);
      if (row.avg_value > overallAvg) {
        avgCell.style = {
          ...dataStyle,
          font: { color: { argb: "006100" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "C6EFCE" },
          },
        };
      } else {
        avgCell.style = {
          ...dataStyle,
          font: { color: { argb: "9C0006" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC7CE" },
          },
        };
      }
    });

    // Set column widths and freeze panes
    [detailedSheet, summarySheet, dashboardSheet].forEach((sheet) => {
      sheet.columns.forEach((column) => {
        column.width = 15;
      });
      // Freeze the header row
      sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    const s3 = new AWS.S3();
    const s3Params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${jobId}.xlsx`,
      Body: excelBuffer,
    };
    await s3.putObject(s3Params).promise();

    const presignedUrl = await s3.getSignedUrlPromise("getObject", {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${jobId}.xlsx`,
      Expires: 3600,
    });

    await updateReportStatus(jobId, "COMPLETED", presignedUrl);
    const endTime = new Date();
    const duration = endTime - startTime;
    logger.info(`Enhanced Excel report generated in ${duration}ms`);
    return {
      jobId,
      status: "COMPLETED",
      s3Url: presignedUrl,
      itemsProcessed: allData.length,
    };
  } catch (error) {
    await updateReportStatus(jobId, "FAILED", null);
    logger.error(`Error generating Excel report: ${error}`);
    throw error;
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
