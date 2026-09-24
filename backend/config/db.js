const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI is not set. Copy .env.example to .env and configure it.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.warn('Could not connect to configured MongoDB URI:', err.message);
    try {
      console.log('Starting local in-memory MongoDB fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log(`Fallback connected: In-memory MongoDB running at ${memoryUri}`);
    } catch (fallbackErr) {
      console.error('MongoDB fallback connection failed:', fallbackErr.message);
      process.exit(1);
    }
  }
}

module.exports = connectDB;
