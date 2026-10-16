const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const env = require("./config/env");
const { helmetMiddleware, corsMiddleware, apiLimiter } = require("./config/security");
const connectDB = require("./config/db");
const { identify } = require("./app/middlewares/identify");
const { notFound, errorHandler } = require("./app/middlewares/errorHandler");
const caseRoutes = require("./app/routes/caseRoutes");
const workspaceRoutes = require("./app/routes/workspaceRoutes");
const watchlistRoutes = require("./app/routes/watchlistRoutes");
const { search } = require("./app/controllers/caseController");

const createApp = () => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(env.cookieSecret));
  app.use(identify);

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", apiLimiter);
  app.use("/api/cases", caseRoutes);
  app.use("/api/watchlist", watchlistRoutes);
  app.get("/api/search", search);
  app.use("/api/workspace", workspaceRoutes);
  app.use("/api", notFound);

  // Serve the built frontend when it exists (single-service deployment).
  const dist = path.resolve(__dirname, "../frontend/dist");
  if (fs.existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist, { maxAge: "1h", index: false }));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    app.get("/", (req, res) => res.json({ status: "ThreatLens API operational" }));
  }

  app.use(errorHandler);
  return app;
};

const start = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error(`[threatlens] Could not connect to MongoDB at ${env.dbUri}`);
    console.error(`[threatlens] ${err.message}`);
    console.error("[threatlens] Start MongoDB or set DB_URI in backend/.env and try again.");
    process.exit(1);
  }
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[threatlens] API listening on http://localhost:${env.port}`);
  });
};

if (require.main === module) start();

module.exports = { createApp, start };
