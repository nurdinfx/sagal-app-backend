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

// Enhanced Socket.io configuration for production
const io = socketIo(server, {
  cors: {
    origin: isProduction 
      ? [
          "https://sagal-app-backend.onrender.com", // Your actual backend domain
          "http://localhost:8081", // YOUR FRONTEND
          "exp://*.expo.dev", // All Expo development URLs
          "http://localhost:19006", // Expo web
          "http://10.238.151.107:8081" // Your local network
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
          "https://sagal-app-backend.onrender.com", // Your backend domain
          "http://localhost:8081", // YOUR FRONTEND
          "exp://*.expo.dev", // All Expo development URLs
          "http://localhost:19006", // Expo web
          "http://10.238.151.107:8081" // Your local network
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
        origin.includes('localhost') || // Allow all localhost
        origin.includes('sagal-app-backend.onrender.com')) {
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
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`); // FIXED: toISOString()
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

// ... rest of your server.js code remains the same