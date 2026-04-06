/**
 * config/db.js
 * Establishes and manages the MongoDB connection via Mongoose.
 * Uses the MONGO_URI environment variable for the connection string.
 */

const mongoose = require("mongoose");

/**
 * connectDB — connects to MongoDB Atlas and logs the result.
 * Call this once during server startup (before listening on a port).
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress Mongoose deprecation warnings
      serverSelectionTimeoutMS: 5000, // Fail fast if Atlas is unreachable
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    // Exit the process so the server does not run without a database
    process.exit(1);
  }
};

module.exports = connectDB;
