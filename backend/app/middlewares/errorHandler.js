const multer = require("multer");
const env = require("../../config/env");

const notFound = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File is too large. The maximum size is ${env.maxUploadMb} MB.`,
      LIMIT_FILE_COUNT: "Too many files uploaded.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field. Upload the CSV using the provided form.",
    };
    return res.status(400).json({ error: messages[err.code] || err.message });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid identifier." });
  }

  if (err.name === "ValidationError" && err.errors) {
    return res.status(400).json({
      error: "Validation failed.",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("[threatlens] Unhandled error:", err);

  res.status(status).json({
    error: status >= 500 && env.isProduction ? "Something went wrong on our side. Please try again." : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(err.found ? { found: err.found } : {}),
  });
};

module.exports = { notFound, errorHandler };
