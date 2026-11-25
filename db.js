const mysql = require('mysql2/promise');

/**
 * MySQL connection pool configured via environment variables.
 * dateStrings: true keeps DATE columns as 'YYYY-MM-DD' strings without timezone drift.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootroot',
  database: process.env.DB_NAME || 'todosdb',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
