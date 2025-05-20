require("dotenv").config();
const express = require("express");
const cors = require("cors");
const winston = require("winston");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const db = require("./services/database");
const insertMockSiloData = require("./services/mock-silo");
const aggregateData = require("./services/aggregate-data");
const cron = require("node-cron");
// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, "openapi.yaml"));

// Create logger
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

// mock silo data - insert every 1 second
logger.info("Mock data being inserted...");
setInterval(() => {
  insertMockSiloData();
}, 1000); // 1000ms = 1 second

// cron job to aggregate 10 minutes
cron.schedule("*/10 * * * *", async () => {
  logger.info("Aggregating data...");
  await aggregateData();
});

// Import routes
const reportRoutes = require("./routes/report");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next();
});

// Serve OpenAPI documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Silo Report API Documentation",
    customfavIcon: "/favicon.ico",
  })
);

// Routes
app.use("/api", reportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;

// Function to start the server
async function startServer() {
  try {
    // Check database connection before starting the server
    await db.ping();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(
        `API documentation available at http://localhost:${PORT}/api-docs`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
