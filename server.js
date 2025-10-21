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

// ✅ Allowed frontend URLs - Updated with your frontend
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081", 
  "http://localhost:19006",
  "http://localhost:19000",
  "exp://localhost:19000",
  "exp://10.238.151.107:8081",
  "https://sagal-app.onrender.com",
  "http://127.0.0.1:8081",
  "http://192.168.1.*:8081" // Allow local network access
];

// ✅ Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Check for local network access
    if (origin.startsWith('http://192.168.1.') && origin.endsWith(':8081')) {
      return callback(null, true);
    }
    
    // Check for localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log('🚫 CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ✅ Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // More requests allowed in development
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// ✅ Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// ✅ Serve static files for admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ✅ MongoDB connection with better error handling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sagal_gas_delivery';
    
    console.log('🔗 Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    
    // In production, retry connection with exponential backoff
    if (isProduction) {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    } else {
      console.log('💡 Development mode - Please make sure MongoDB is running');
      process.exit(1);
    }
  }
};

// MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// ✅ Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ✅ Health check endpoint with better diagnostics
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const healthCheck = {
    status: dbStatus === 1 ? 'OK' : 'WARNING',
    message: dbStatus === 1 ? '🚀 Sagal Gas API is running smoothly' : '⚠️ Database connection issue',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    database: statusMap[dbStatus] || 'unknown',
    version: '1.0.0',
    baseUrl: 'https://sagal-app.onrender.com',
    uptime: `${process.uptime().toFixed(2)}s`,
    memory: {
      used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
    }
  };
  
  res.json(healthCheck);
});

// ✅ API Status endpoint with error handling
app.get('/api/status', async (req, res) => {
  try {
    // Use dynamic import to avoid circular dependencies
    const Order = mongoose.model('Order') || require('./models/Order');
    
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    
    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        serverTime: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system status',
      error: isProduction ? undefined : error.message
    });
  }
});

// ✅ Debug endpoint to test all routes
app.get('/api/debug', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    success: true,
    message: 'Debug endpoint - Server is running correctly',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /api/health',
      status: 'GET /api/status',
      auth: {
        login: 'POST /api/auth/login',
        test: 'GET /api/auth/test'
      },
      orders: {
        create: 'POST /api/orders',
        list: 'GET /api/orders',
        stats: 'GET /api/orders/stats',
        search: 'GET /api/orders/search',
        getById: 'GET /api/orders/:id',
        updateStatus: 'PUT /api/orders/:id/status',
        delete: 'DELETE /api/orders/:id'
      },
      admin: 'GET /admin'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: PORT,
      database: statusMap[dbStatus] || 'unknown',
      allowed_origins: ALLOWED_ORIGINS
    },
    system: {
      node_version: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    }
  });
});

// ✅ Root endpoint with better documentation
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Welcome to Sagal Gas Delivery API',
    version: '1.0.0',
    documentation: {
      health: '/api/health',
      status: '/api/status', 
      debug: '/api/debug',
      api: {
        auth: '/api/auth',
        orders: '/api/orders'
      },
      admin: '/admin'
    },
    frontend_urls: ALLOWED_ORIGINS.filter(origin => origin.includes('http')),
    support: 'Check /api/debug for detailed endpoint information'
  });
});

// ✅ Test endpoint for CORS
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    your_origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    allowed_origins: ALLOWED_ORIGINS
  });
});

// ✅ Socket.io for real-time updates with better error handling
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id, 'Origin:', socket.handshake.headers.origin);
  
  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('👨‍💼 Admin joined admin room:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Make io available to routes
app.set('io', io);

// ✅ Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: {
      home: '/',
      admin: '/admin',
      health: '/api/health',
      status: '/api/status',
      debug: '/api/debug',
      test_cors: '/api/test-cors',
      auth: '/api/auth',
      orders: '/api/orders'
    }
  });
});

// ✅ Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message,
      details: error.errors
    });
  }
  
  // Mongoose cast error (invalid ID)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value entered',
      field: Object.keys(error.keyPattern)[0]
    });
  }

  // CORS error
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS Error: Your origin is not allowed',
      allowedOrigins: ALLOWED_ORIGINS
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(isProduction ? {} : { stack: error.stack })
  });
});

// ✅ Start server with better initialization
const startServer = async () => {
  try {
    console.log('🚀 Starting Sagal Gas Delivery Server...');
    console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    
    // Connect to database first
    await connectDB();
    
    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎉 ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} Server Started Successfully!`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 Base URL: https://sagal-app.onrender.com`);
      console.log(`🏢 Admin Panel: https://sagal-app.onrender.com/admin`);
      console.log(`🔧 Health Check: https://sagal-app.onrender.com/api/health`);
      console.log(`🐛 Debug Info: https://sagal-app.onrender.com/api/debug`);
      console.log(`🔍 CORS Test: https://sagal-app.onrender.com/api/test-cors`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`🎯 Frontend URL: http://localhost:8081`);
      console.log(`🚀 Ready for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} use\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;