const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const env = require("./env");

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

const corsMiddleware = cors({
  origin(origin, callback) {
    // Same-origin requests and tools such as curl send no Origin header.
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 10000 : 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 10000 : 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Upload limit reached. Please wait a few minutes before uploading again." },
});

module.exports = { helmetMiddleware, corsMiddleware, apiLimiter, uploadLimiter };
