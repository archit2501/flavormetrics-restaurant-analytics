import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import ordersRouter from './routes/orders';
import menuRouter from './routes/menu';
import analyticsRouter from './routes/analytics';
import forecastRouter from './routes/forecast';
import customersRouter from './routes/customers';
import staffRouter from './routes/staff';
import inventoryRouter from './routes/inventory';
import authRouter from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/menu', menuRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/forecast', forecastRouter);
app.use('/api/customers', customersRouter);
app.use('/api/staff', staffRouter);
app.use('/api/inventory', inventoryRouter);

// Error handler
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe:restaurant', (restaurantId: string) => {
    socket.join(`restaurant:${restaurantId}`);
    logger.info(`Client ${socket.id} subscribed to restaurant ${restaurantId}`);
  });

  socket.on('subscribe:kitchen', (restaurantId: string) => {
    socket.join(`kitchen:${restaurantId}`);
    logger.info(`Client ${socket.id} subscribed to kitchen ${restaurantId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  logger.info(`FlavorMetrics server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
