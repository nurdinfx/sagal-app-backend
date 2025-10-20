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
const PORT = process.env.PORT || 5000;

// Enhanced Socket.io configuration for production
const io = socketIo(server, {
  cors: {
    origin: isProduction 
      ? [
          "https://yourapp.com", // Your production domain
          "exp://yourapp.exp.host", // Your Expo app URL
          "https://sagal-app.onrender.com", // Your Render domain
          "exp://*.expo.dev", // All Expo development URLs
          "http://localhost:19006", // Expo web
          "http://localhost:8081" // React Native debugger
        ]
      : [
          "http://localhost:8081",
          "http://localhost:19006", 
          "http://localhost:19000",
          "exp://localhost:19000",
          "http://192.168.1.100:8081",
          "exp://192.168.1.100:8081",
          "http://10.238.151.107:8081",
          "exp://10.238.151.107:8081",
          "http://10.238.151.107:19006",
          "http://10.238.151.107:19000",
          "exp://*.expo.dev" // All Expo URLs
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

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = isProduction 
      ? [
          "https://yourapp.com", // Your production frontend domain
          "exp://yourapp.exp.host", // Your Expo app
          "https://your-backend.railway.app", // Your backend domain
          "https://sagal-app.onrender.com", // Your Render domain
          "exp://*.expo.dev", // All Expo development URLs
          "http://localhost:19006", // Expo web
          "http://localhost:8081" // React Native debugger
        ]
      : [
          "http://localhost:8081",
          "http://localhost:19006",
          "http://localhost:19000",
          "exp://localhost:19000",
          "http://192.168.1.100:8081",
          "exp://192.168.1.100:8081",
          "http://10.238.151.107:8081",
          "http://10.238.151.107:19006",
          "http://10.238.151.107:19000",
          "exp://10.238.151.107:8081",
          "http://10.238.151.107:5000",
          "http://localhost:3000",
          "exp://*.expo.dev" // All Expo URLs
        ];

    // Allow all Expo development URLs and your Render domain
    if (allowedOrigins.indexOf(origin) !== -1 || 
        !origin || 
        origin.includes('expo.dev') ||
        origin.includes('sagal-app.onrender.com')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

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

// Serve static files from admin folder
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Database connection with enhanced error handling and production settings
const connectDB = async () => {
  try {
    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // Add retry logic for production
    if (isProduction) {
      mongoOptions.retryWrites = true;
      mongoOptions.w = 'majority';
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gas_delivery', mongoOptions);
    
    console.log(`✅ MongoDB Connected successfully - Environment: ${isProduction ? 'Production' : 'Development'}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // In production, don't exit immediately, allow for retries
    if (!isProduction) {
      process.exit(1);
    }
  }
};

// MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected');
  if (isProduction) {
    console.log('🔄 Attempting to reconnect...');
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// Admin route redirect
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Enhanced Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Gas Delivery API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  };
  
  // Don't expose sensitive info in production
  if (!isProduction) {
    healthCheck.serverIP = '10.238.151.107';
    healthCheck.accessibleURLs = [
      `http://localhost:${PORT}`,
      `http://10.238.151.107:${PORT}`
    ];
  }
  
  res.json(healthCheck);
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const Order = require('./models/Order');
    
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const todayOrders = await Order.countDocuments({
      createdAt: { 
        $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
      }
    });

    const response = {
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        todayOrders,
        serverTime: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Only include IP in development
    if (!isProduction) {
      response.data.serverIP = '10.238.151.107';
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching system status'
    });
  }
});

// Root route with API documentation
app.get('/', (req, res) => {
  const response = {
    message: '🚀 Welcome to Sagal Gas Delivery API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health_check: '/api/health',
      api_status: '/api/status',
      api_docs: {
        orders: {
          create: 'POST /api/orders',
          list: 'GET /api/orders',
          stats: 'GET /api/orders/stats'
        },
        auth: {
          login: 'POST /api/auth/login'
        }
      }
    },
    support: 'For issues, contact support@sagalgas.com'
  };

  // Only include local URLs in development
  if (!isProduction) {
    response.serverIP = '10.238.151.107';
    response.endpoints.admin_panel = `http://10.238.151.107:${PORT}/admin`;
    response.frontend_connection = `Use http://10.238.151.107:${PORT}/api in your React Native app`;
  }

  res.json(response);
});

// Enhanced Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);
  
  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('👨‍💼 Admin joined admin room:', socket.id);
    
    // Send welcome message to admin
    socket.emit('admin_welcome', {
      message: 'Welcome to Sagal Gas Admin Panel',
      connectedClients: io.engine.clientsCount,
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  socket.on('join_driver', (driverId) => {
    socket.join(`driver_${driverId}`);
    console.log(`🚚 Driver ${driverId} joined`);
  });

  socket.on('order_status_update', (data) => {
    console.log('Order status update:', data);
    // Broadcast to relevant rooms
    io.to('admin_room').emit('order_updated', data);
    if (data.driverId) {
      io.to(`driver_${data.driverId}`).emit('order_assigned', data);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Heartbeat to keep connection alive
  socket.on('ping', (data) => {
    socket.emit('pong', { 
      ...data, 
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });
});

// Make io accessible to routes
app.set('io', io);

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', {
    message: error.message,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Don't expose stack traces in production
  if (isProduction) {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }

    // Mongoose duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found'
      });
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    // CORS errors
    if (error.message.includes('CORS')) {
      return res.status(403).json({
        success: false,
        message: 'CORS policy violation'
      });
    }

    // Default error for production
    res.status(error.status || 500).json({
      success: false,
      message: 'Internal server error'
    });
  } else {
    // Development error handling with full details
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Internal server error',
      stack: error.stack,
      ...(error.name && { errorType: error.name })
    });
  }
});

// Handle unhandled routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: {
      home: '/',
      admin: '/admin',
      health: '/api/health',
      status: '/api/status',
      orders: '/api/orders',
      auth: '/api/auth'
    }
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('🚨 Unhandled Promise Rejection:', err.message);
  if (!isProduction) {
    console.log(err.stack);
  }
  
  // In production, don't exit immediately
  if (!isProduction) {
    server.close(() => {
      process.exit(1);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('🚨 Uncaught Exception:', err.message);
  if (!isProduction) {
    console.log(err.stack);
  }
  
  // In production, don't exit immediately
  if (!isProduction) {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  
  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed.');
  });

  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
  }

  console.log('📦 Process terminated.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  
  server.close(() => {
    console.log('✅ HTTP server closed.');
  });

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
  }

  process.exit(0);
});

// Start server after database connection
const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} Server running on port ${PORT}`);
      console.log(`📍 Local Access: http://localhost:${PORT}`);
      
      if (!isProduction) {
        console.log(`🌐 Network Access: http://10.238.151.107:${PORT}`);
        console.log(`🏢 Office Admin Panel: http://10.238.151.107:${PORT}/admin`);
        console.log(`🔗 API Health: http://10.238.151.107:${PORT}/api/health`);
      }
      
      console.log(`⏰ Server started at: ${new Date().toISOString()}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Ready for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} use\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (!isProduction) {
      process.exit(1);
    }
  }
};

// Start the server
startServer();

module.exports = app;