'use strict';
const mongoose = require('mongoose');
const env = require('./env');
async function connectDB() {
  if (!env.mongoUri) throw new Error('MONGODB_URI is required. Configure it in the deployment environment.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[ICF] MongoDB connected: ${mongoose.connection.name}`);
}
module.exports = { mongoose, connectDB };
