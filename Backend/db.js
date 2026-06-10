require("dotenv").config();

const { Pool } = require("pg");

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is missing. Add it to your .env file.");
}

const parsedUrl = new URL(rawConnectionString);
parsedUrl.searchParams.delete("sslmode");

const connectionString = parsedUrl.toString();
const usesSsl =
  !connectionString.includes("localhost") &&
  !connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: usesSsl ? { rejectUnauthorized: false } : false,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
