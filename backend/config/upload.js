const multer = require("multer");
const env = require("./env");

const csvFilter = (req, file, cb) => {
  const okName = /\.csv$/i.test(file.originalname);
  const okType = [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
    "application/octet-stream",
  ].includes(file.mimetype);
  if (okName && okType) return cb(null, true);
  const err = new Error("Only .csv files are supported.");
  err.status = 400;
  return cb(err);
};

// Files are processed in memory and never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 2 },
  fileFilter: csvFilter,
});

module.exports = upload;
