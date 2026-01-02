import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';

// ✅ Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

// ✅ Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ✅ Routes
app.use('/api', authRoutes);

// ✅ MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ✅ Start Server
const PORT = process.env.PORT || 10000; // Render default
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
