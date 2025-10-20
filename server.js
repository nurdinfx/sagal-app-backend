const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const server = http.createServer(app);

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;

// ✅ Real frontend + local dev URLs
const FRONTEND_URLS = [
  "http://localhost:3000",       // Next.js local
  "http://localhost:8081",       // Expo web local
  "http://localhost:19006",      // Expo Metro bundler
  "exp://localhost:19000",       // Expo mobile
  "https://sagal-app-frontend.onrender.com" // Your deployed frontend (if any)
];

// ✅ CORS configuration — supports local + Render frontend
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiting (protects from abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP. Please try again later.',
});
app.use(limiter);

// ✅ Serve admin panel if exists
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ✅ MongoDB connection (works on Render & local)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/sagal_gas_delivery',
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (isProduction) setTimeout(connectDB, 5000);
  }
};

// ✅ Routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// ✅ Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ✅ Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    alive: true,
    message: '🔥 Sagal Gas API is alive and running!',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    frontend: FRONTEND_URLS,
  });
});

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to Sagal Gas Delivery API',
    version: '1.0.0',
    base_url: 'https://sagal-app-backend.onrender.com',
    endpoints: {
      health: '/api/health',
      orders: '/api/orders',
      auth: '/api/auth',
      admin: '/admin',
    },
  });
});

// ✅ Socket.io real-time setup
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URLS,
    methods: ["GET", "POST"],
  },
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('👨‍💼 Admin joined admin room');
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

app.set('io', io);

// ✅ Start server
const startServer = async () => {
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Backend URL: https://sagal-app-backend.onrender.com`);
    console.log(`📱 Frontend (Expo): http://localhost:8081`);
    console.log(`📍 Environment: ${isProduction ? 'Production' : 'Development'}`);
  });
};

startServer();

module.exports = app;
