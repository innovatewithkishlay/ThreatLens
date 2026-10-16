const crypto = require("crypto");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const required = (name, devFallback) => {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
};

// In development we generate an ephemeral secret so the app boots without any
// setup. Sessions simply reset whenever the server restarts.
const devSecret = crypto.randomBytes(32).toString("hex");

const env = {
  isProduction,
  isTest: process.env.NODE_ENV === "test",
  port: Number(process.env.PORT) || 5002,
  dbUri: process.env.DB_URI || "mongodb://127.0.0.1:27017/threatlens",
  cookieSecret: required("COOKIE_SECRET", devSecret),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  maxRows: Number(process.env.MAX_ROWS) || 25000,
};

if (!process.env.COOKIE_SECRET && !isProduction && !env.isTest) {
  console.warn(
    "[threatlens] COOKIE_SECRET not set - using an ephemeral development secret (workspace cookies reset on restart)."
  );
}

module.exports = env;
