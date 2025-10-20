// FORCE PRODUCTION MODE - Add this at the very top
process.env.NODE_ENV = 'production';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Fix for rate limit warning on Render
app.set('trust proxy', 1);
const server = http.createServer(app);

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration - SIMPLIFIED AND FIXED
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, server-side requests)
    if (!origin) {
      return callback(null, true);
    }
    
    console.log('🔍 CORS Check - Origin:', origin);
    console.log('🔍 CORS Check - Environment:', isProduction ? 'production' : 'development');
    
    // Comprehensive allowed origins list
    const allowedOrigins = [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:19000",
      "http://localhost:3000",
      "http://10.238.151.107:8081",
      "http://10.238.151.107:19006",
      "http://10.238.151.107:19000",
      "http://192.168.1.100:8081",
      "https://sagal-app-backend.onrender.com",
      "exp://localhost:19000",
      "exp://10.238.151.107:8081",
      "exp://192.168.1.100:8081"
    ];

    // Flexible matching - allow all localhost, all Expo, and all Render domains
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('onrender.com') ||
        origin.includes('expo.dev') ||
        origin.includes('192.168.') ||
        origin.includes('10.238.') ||
        allowedOrigins.includes(origin)) {
      console.log('✅ Allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('🚨 CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Enhanced Socket.io configuration for production
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:19000",
      "http://10.238.151.107:8081",
      "http://10.238.151.107:19006",
      "https://sagal-app-backend.onrender.com",
      "exp://localhost:19000",
      "exp://10.238.151.107:8081",
      "exp://*.expo.dev"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Rate limiting - stricter in production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 50 : 100, // Stricter limit in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware with better production logging
app.use((req, res, next) => {
  if (isProduction) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
  } else {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  
  if (req.method === 'POST' && req.url === '/api/orders') {
    console.log('📦 Order received:', {
      customerName: req.body.customerName,
      phoneNumber: req.body.phoneNumber,
      itemsCount: req.body.items?.length,
      totalAmount: req.body.totalAmount
    });
  }
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected successfully - Environment: ${isProduction ? 'Production' : 'Development'}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running!',
    environment: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development'
  });
});

// Test CORS endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    environment: isProduction ? 'production' : 'development'
  });
});

// Auth routes placeholder
app.post('/api/auth/login', (req, res) => {
  console.log('🔐 Login attempt from:', req.headers.origin);
  res.json({
    success: true,
    message: 'Login endpoint reached successfully - CORS is working!',
    origin: req.headers.origin
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 PRODUCTION Server running on port', PORT);
      console.log('📍 Local Access: http://localhost:' + PORT);
      console.log('⏰ Server started at:', new Date().toISOString());
      console.log('🌍 Environment:', isProduction ? 'production' : 'development');
      console.log('📊 Ready for PRODUCTION use');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;