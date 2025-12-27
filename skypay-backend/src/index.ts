// skypay-backend/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { setupSwagger } from './docs/swagger';
import { initRedis } from './services/redis';
import { initQueue } from './services/queue';
import { initDatabase } from './database';
import { initWeb3 } from './services/web3';

// Routes
import authRoutes from './api/routes/auth.routes';
import userRoutes from './api/routes/user.routes';
import settlementRoutes from './api/routes/settlement.routes';
import ledgerRoutes from './api/routes/ledger.routes';
import complianceRoutes from './api/routes/compliance.routes';
import webhookRoutes from './api/routes/webhook.routes';
import adminRoutes from './api/routes/admin.routes';

async function bootstrap() {
  // Initialize services
  logger.info('Initializing SkyPay Backend...');
  
  await initDatabase();
  logger.info('Database initialized');
  
  await initRedis();
  logger.info('Redis initialized');
  
  await initQueue();
  logger.info('Queue initialized');
  
  await initWeb3();
  logger.info('Web3 initialized');
  
  // Create Express app
  const app = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
  
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));
  
  app.use(compression());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  
  app.use(limiter);
  
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Request logging
  app.use(requestLogger);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'SkyPay Backend',
      version: config.version,
      environment: config.nodeEnv,
    });
  });
  
  // API Documentation
  setupSwagger(app);
  
  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/settlements', settlementRoutes);
  app.use('/api/v1/ledger', ledgerRoutes);
  app.use('/api/v1/compliance', complianceRoutes);
  app.use('/api/v1/webhooks', webhookRoutes);
  app.use('/api/v1/admin', adminRoutes);
  
  // Error handling
  app.use(errorHandler);
  
  // Start server
  app.listen(config.port, () => {
    logger.info(`
    🚀 SkyPay Backend Started
    ============================
    📡 Port: ${config.port}
    🌍 Environment: ${config.nodeEnv}
    🗄️  Database: ${config.database.host}
    🔗 Redis: ${config.redis.host}
    📊 Queue: Bull (${config.redis.host})
    ⏰ Time: ${new Date().toISOString()}
    ============================
    `);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
