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
    new winston.transports.File({ filename: "logs/database-service.log" }),
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

class DatabaseService {
  async ping() {
    try {
      const connection = await this.getConnection();
      await connection.ping();
      connection.release();
      logger.info("Database connection successful");
      return true;
    } catch (error) {
      logger.error("Database connection failed:", error);
      throw error;
    }
  }

  async getConnection() {
    return await pool.getConnection();
  }

  async executeQuery(sql, params = []) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error(`Error executing query: ${sql}`, error);
      throw error;
    }
  }

  async executeTransaction(callback) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new DatabaseService();
