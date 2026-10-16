const mongoose = require("mongoose");
const env = require("./env");

const connectDB = async (uri = env.dbUri) => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  if (!env.isTest) console.log("MongoDB connected");
  return mongoose.connection;
};

module.exports = connectDB;
