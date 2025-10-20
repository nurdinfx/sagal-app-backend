const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration for Render
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
      "https://your-frontend-app.onrender.com", // Your frontend on Render
      "exp://localhost:19000"
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Serve static files for admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// MongoDB connection with Render compatibility
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/gas_delivery',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    // In production, wait and retry
    if (isProduction) {
      setTimeout(connectDB, 5000);
    }
  }
};

// Routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Sagal Gas API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Sagal Gas Delivery API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      orders: '/api/orders',
      auth: '/api/auth',
      admin: '/admin'
    }
  });
});

// Socket.io for real-time updates
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://your-frontend-app.onrender.com"],
    methods: ["GET", "POST"]
  }
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

// Start server
const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${isProduction ? 'Production' : 'Development'}`);
  });
};

startServer();

module.exports = app;