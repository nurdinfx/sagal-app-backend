const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const server = http.createServer(app);

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;

// ✅ Allowed frontend + backend URLs
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "https://sagal-app.onrender.com", // backend
  "https://sagal-app-frontend-xhq7.vercel.app" // ✅ frontend (Vercel)
];

// ✅ Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow mobile/CLI/no-origin
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1'))
      return callback(null, true);

    console.log('🚫 CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

// ✅ Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: { success: false, message: 'Too many requests, try again later.' },
});
app.use(limiter);

// ✅ Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// ✅ Serve static admin files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ✅ Connect MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sagal_gas_delivery';
    console.log('🔗 Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (isProduction) setTimeout(connectDB, 5000);
    else process.exit(1);
  }
};

// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// ✅ Health endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: dbStatus === 1 ? 'OK' : 'WARNING',
    message: dbStatus === 1 ? '🚀 Sagal Gas API is running smoothly' : '⚠️ DB issue',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    database: statusMap[dbStatus] || 'unknown',
    baseUrl: 'https://sagal-app.onrender.com',
    frontendUrl: 'https://sagal-app-frontend-xhq7.vercel.app',
  });
});

// ✅ Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const Order = mongoose.model('Order') || require('./models/Order');
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        serverTime: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching system status', error: error.message });
  }
});

// ✅ Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running correctly',
    frontend: 'https://sagal-app-frontend-xhq7.vercel.app',
    backend: 'https://sagal-app.onrender.com',
    endpoints: ['/api/health', '/api/status', '/api/auth', '/api/orders'],
    allowed_origins: ALLOWED_ORIGINS,
    timestamp: new Date().toISOString()
  });
});

// ✅ Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to Sagal Gas Delivery API',
    version: '1.0.0',
    documentation: {
      health: '/api/health',
      status: '/api/status',
      debug: '/api/debug',
      auth: '/api/auth',
      orders: '/api/orders'
    },
    frontend: 'https://sagal-app-frontend-xhq7.vercel.app'
  });
});

// ✅ CORS test
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    origin: req.headers.origin,
    allowed: ALLOWED_ORIGINS.includes(req.headers.origin),
    allowed_origins: ALLOWED_ORIGINS
  });
});

// ✅ Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('❌ Socket disconnected:', socket.id));
});
app.set('io', io);

// ✅ 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    available: ['/api/health', '/api/status', '/api/debug', '/api/orders', '/api/auth']
  });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  if (err.message === 'Not allowed by CORS')
    return res.status(403).json({ success: false, message: 'CORS Error', allowedOrigins: ALLOWED_ORIGINS });
  res.status(500).json({ success: false, message: err.message });
});

// ✅ Start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on https://sagal-app.onrender.com`);
      console.log(`🌐 Frontend connected: https://sagal-app-frontend-xhq7.vercel.app`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
