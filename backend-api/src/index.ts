import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { AppDataSource } from './config/database'
import { errorHandler } from './middlewares/errorHandler'
import { requestLogger } from './middlewares/logger'
import { authenticate } from './middlewares/auth'
import apiRoutes from './routes'
import { setupSwagger } from './config/swagger'
import { setupMetrics } from './config/metrics'
import { WebSocketService } from './services/websocket'
import { NotificationService } from './services/notification'
import { ComplianceService } from './services/compliance'

class Application {
  public app: express.Application
  public port: number
  private server: any
  private io: Server

  constructor() {
    this.app = express()
    this.port = parseInt(process.env.PORT || '3001')
    this.server = createServer(this.app)
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
    })

    this.initializeDatabase()
    this.initializeMiddlewares()
    this.initializeRoutes()
    this.initializeErrorHandling()
    this.initializeWebSocket()
    this.initializeServices()
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await AppDataSource.initialize()
      console.log('📦 Database connected successfully')
      
      // Run migrations
      await AppDataSource.runMigrations()
      console.log('🔄 Database migrations completed')
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      process.exit(1)
    }
  }

  private initializeMiddlewares(): void {
    // Security middlewares
    this.app.use(helmet())
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    }))

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    })
    this.app.use('/api/', limiter)

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Compression
    this.app.use(compression())

    // Request logging
    this.app.use(requestLogger)

    // Metrics
    setupMetrics(this.app)
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
      })
    })

    // API Documentation
    setupSwagger(this.app)

    // API Routes
    this.app.use('/api/v1', apiRoutes)

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
      })
    })
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler)
  }

  private initializeWebSocket(): void {
    const webSocketService = new WebSocketService(this.io)
    webSocketService.initialize()
    console.log('🔌 WebSocket server initialized')
  }

  private async initializeServices(): Promise<void> {
    // Initialize notification service
    await NotificationService.initialize()
    
    // Initialize compliance service
    await ComplianceService.initialize()
    
    console.log('🚀 All services initialized')
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`✅ Server is running on port ${this.port}`)
      console.log(`📚 API Documentation: http://localhost:${this.port}/api-docs`)
      console.log(`📊 Metrics: http://localhost:${this.port}/metrics`)
    })
  }
}

// Create and start the application
const app = new Application()
app.start()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Starting graceful shutdown...')
  
  // Close database connection
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log('Database connection closed')
  }
  
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received. Starting graceful shutdown...')
  
  // Close database connection
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log('Database connection closed')
  }
  
  process.exit(0)
})

export default app.app
