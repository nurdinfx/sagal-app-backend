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

// ✅ Allowed frontend URLs
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081", 
  "http://localhost:19006",
  "http://localhost:19000",
  "exp://localhost:19000",
  "exp://10.238.151.107:8081",
  "https://sagal-app.onrender.com" // Your actual Render URL
];

// ✅ Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      // Log blocked origins for debugging
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ✅ Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ Serve static files for admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ✅ MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/sagal_gas_delivery',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    // In production, retry connection
    if (isProduction) {
      setTimeout(connectDB, 5000);
    }
  }
};

// ✅ Routes (FIXED: No duplicates)
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

// ✅ Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ✅ Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: '🚀 Sagal Gas API is running smoothly',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '1.0.0',
    baseUrl: 'https://sagal-app.onrender.com'
  };
  
  res.json(healthCheck);
});

// ✅ API Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const Order = require('./models/Order');
    
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
    res.status(500).json({
      success: false,
      message: 'Error fetching system status'
    });
  }
});

// ✅ Debug endpoint to test all routes
app.get('/api/debug', (req, res) => {
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
        stats: 'GET /api/orders/stats'
      },
      admin: 'GET /admin'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: PORT,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  });
});

// ✅ Root endpoint
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
    support: 'For issues, check the documentation'
  });
});

// ✅ Socket.io for real-time updates
const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
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
      auth: '/api/auth',
      orders: '/api/orders'
    }
  });
});

// ✅ Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// ✅ Start server
const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} Server Started`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 Base URL: https://sagal-app.onrender.com`);
      console.log(`🏢 Admin Panel: https://sagal-app.onrender.com/admin`);
      console.log(`🔧 Health Check: https://sagal-app.onrender.com/api/health`);
      console.log(`🐛 Debug Info: https://sagal-app.onrender.com/api/debug`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log(`📊 Ready for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} use\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down...');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

startServer();

module.exports = app;