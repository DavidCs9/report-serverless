require("dotenv").config();
const express = require("express");
const cors = require("cors");
const winston = require("winston");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

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

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(
    `API documentation available at http://localhost:${PORT}/api-docs`
  );
});
