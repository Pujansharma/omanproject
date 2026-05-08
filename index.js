// index.js - CORRECTED VERSION (no deprecated options)
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const path = require('path');
const path = require('path');

require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const orderRoutes = require('./src/routes/order');
const branchRoutes = require('./src/routes/branch');
const customerRoutes = require('./src/routes/customer');
const adminRoutes = require('./src/routes/admin');

// Import utilities
const { setupWebSocket } = require('./src/websocket');
const { errorHandler } = require('./src/middleware/errorHandler');
const logger = require('./src/utils/loggers');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Database connection - REMOVED DEPRECATED OPTIONS
console.log('Attempting to connect to MongoDB Atlas...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Present' : 'Missing');

// DON'T add useNewUrlParser or useUnifiedTopology - they are deprecated in Mongoose 7+
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✓ MongoDB Atlas connected successfully');
  logger.info('MongoDB Atlas connected successfully');
})
.catch(err => {
  console.error('✗ MongoDB connection error:', err.message);
  logger.error('MongoDB connection error:', err);
  // Don't exit the process, just log the error
  console.log('⚠️ Server will continue without database. Some features may not work.');
});

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB Atlas');
});

// Routes
// app.use('/api/create,')
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/admin', adminRoutes);
// Add this route BEFORE the WebSocket setup
// Create order via API (fallback if WebSocket fails)
// In index.js, after creating io
app.set('io', io); // Make io available in routes

// Or pass it to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Static files for frontend
app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.static(path.join(__dirname, 'public')));
// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,  'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname,  'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname,  'login.html'));
});

// Call Center routes
app.get('/call-center', (req, res) => {
  res.sendFile(path.join(__dirname,'call-center', 'index.html'));
});

app.get('/call-center/index.html', (req, res) => {
  res.sendFile(path.join(__dirname,'call-center', 'index.html'));
});

app.get('/call-center/', (req, res) => {
  res.sendFile(path.join(__dirname,'call-center', 'index.html'));
});

// POS routes
app.get('/pos', (req, res) => {
  res.sendFile(path.join(__dirname,  'pos', 'index.html'));
});

app.get('/pos/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pos', 'index.html'));
});

app.get('/pos/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pos', 'index.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Dashboard route (if needed)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Catch-all route for any other HTML pages
app.get('.html', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).sendFile(path.join(__dirname, 'login.html'));
    }
  });
});

// WebSocket setup
// setupWebSocket(io);

// WebSocket setup
setupWebSocket(io);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server is running!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`\n📱 Access the application:`);
  console.log(`   - Login: http://localhost:${PORT}/login.html`);
  console.log(`   - Call Center: http://localhost:${PORT}/call-center/index.html`);
  console.log(`   - POS System: http://localhost:${PORT}/pos/index.html`);
  console.log(`   - Admin Dashboard: http://localhost:${PORT}/admin/index.html`);
  console.log(`\n🔑 Test Credentials:`);
  console.log(`   - Call Center: callcenter / password123`);
  console.log(`   - Branch Staff: branch_dt / password123`);
  console.log(`   - Admin: admin / password123`);
  logger.info(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logger.error('Uncaught Exception:', err);
});