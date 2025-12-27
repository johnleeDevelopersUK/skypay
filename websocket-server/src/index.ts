import { Server } from 'socket.io'
import http from 'http'
import { Redis } from 'ioredis'
import { WebSocketService } from './services/WebSocketService'
import { AuthService } from './services/AuthService'
import { logger } from './utils/logger'
import { RateLimiter } from './utils/RateLimiter'

class WebSocketServer {
  private io: Server
  private redis: Redis
  private rateLimiter: RateLimiter
  private webSocketService: WebSocketService
  private authService: AuthService

  constructor(server: http.Server) {
    // Initialize Socket.IO server
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8, // 100MB
    })

    // Initialize Redis for pub/sub
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    })

    // Initialize services
    this.rateLimiter = new RateLimiter(this.redis)
    this.authService = new AuthService()
    this.webSocketService = new WebSocketService(this.io, this.redis)

    this.initializeMiddleware()
    this.initializeEventHandlers()
    this.initializeRedisSubscriptions()
  }

  private initializeMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token
        
        if (!token) {
          return next(new Error('Authentication token required'))
        }

        const user = await this.authService.verifyToken(token as string)
        if (!user) {
          return next(new Error('Invalid authentication token'))
        }

        // Rate limiting
        const isLimited = await this.rateLimiter.check(
          `ws:${user.id}`,
          100, // 100 connections per minute
          60000
        )

        if (isLimited) {
          return next(new Error('Rate limit exceeded'))
        }

        // Attach user to socket
        socket.data.user = user
        socket.data.userId = user.id
        socket.data.sessionId = socket.id

        next()
      } catch (error) {
        logger.error('WebSocket authentication failed:', error)
        next(new Error('Authentication failed'))
      }
    })
  }

  private initializeEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const user = socket.data.user
      logger.info(`User connected: ${user.id} (${socket.id})`)

      // Join user room for private messages
      socket.join(`user:${user.id}`)

      // Join wallet rooms for balance updates
      socket.join(`wallet:${user.id}:balances`)
      socket.join(`wallet:${user.id}:transactions`)

      // Join compliance room if user has compliance role
      if (user.role === 'compliance' || user.role === 'admin') {
        socket.join('compliance:alerts')
        socket.join('compliance:monitoring')
      }

      // Handle subscription requests
      socket.on('subscribe', async (data: { channel: string; params?: any }) => {
        try {
          await this.handleSubscription(socket, data)
        } catch (error) {
          logger.error('Subscription failed:', error)
          socket.emit('error', { message: 'Subscription failed' })
        }
      })

      // Handle unsubscription requests
      socket.on('unsubscribe', (data: { channel: string }) => {
        socket.leave(data.channel)
        logger.info(`User ${user.id} unsubscribed from ${data.channel}`)
      })

      // Handle ping
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback({ timestamp: Date.now(), serverTime: new Date().toISOString() })
        }
      })

      // Handle balance update requests
      socket.on('balance:request', async (data: { currency?: string }) => {
        try {
          const balances = await this.webSocketService.getUserBalances(user.id, data.currency)
          socket.emit('balance:update', balances)
        } catch (error) {
          logger.error('Balance request failed:', error)
        }
      })

      // Handle transaction history requests
      socket.on('transactions:request', async (data: { limit?: number; offset?: number }) => {
        try {
          const transactions = await this.webSocketService.getUserTransactions(
            user.id,
            data.limit || 50,
            data.offset || 0
          )
          socket.emit('transactions:update', transactions)
        } catch (error) {
          logger.error('Transaction request failed:', error)
        }
      })

      // Handle live transaction streaming
      socket.on('transactions:stream:start', () => {
        socket.join(`transactions:stream:${user.id}`)
        logger.info(`User ${user.id} started transaction streaming`)
      })

      socket.on('transactions:stream:stop', () => {
        socket.leave(`transactions:stream:${user.id}`)
        logger.info(`User ${user.id} stopped transaction streaming`)
      })

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${user.id} (${socket.id}) - Reason: ${reason}`)
        
        // Clean up subscriptions
        this.webSocketService.cleanupUserSubscriptions(user.id)
      })

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${user.id}:`, error)
      })

      // Send connection confirmation
      socket.emit('connected', {
        userId: user.id,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        serverVersion: process.env.npm_package_version || '1.0.0',
      })
    })
  }

  private async handleSubscription(socket: any, data: { channel: string; params?: any }): Promise<void> {
    const user = socket.data.user
    const { channel, params } = data

    switch (channel) {
      case 'balances':
        // Subscribe to balance updates for specific currencies
        if (params?.currencies) {
          const currencies = Array.isArray(params.currencies) ? params.currencies : [params.currencies]
          currencies.forEach((currency: string) => {
            socket.join(`balance:${user.id}:${currency}`)
          })
        } else {
          socket.join(`balance:${user.id}:all`)
        }
        logger.info(`User ${user.id} subscribed to ${channel}`)
        break

      case 'transactions':
        // Subscribe to transaction updates
        socket.join(`transactions:${user.id}`)
        if (params?.types) {
          const types = Array.isArray(params.types) ? params.types : [params.types]
          types.forEach((type: string) => {
            socket.join(`transactions:${user.id}:${type}`)
          })
        }
        logger.info(`User ${user.id} subscribed to ${channel}`)
        break

      case 'market':
        // Subscribe to market data
        if (params?.pairs) {
          const pairs = Array.isArray(params.pairs) ? params.pairs : [params.pairs]
          pairs.forEach((pair: string) => {
            socket.join(`market:${pair}`)
          })
        }
        logger.info(`User ${user.id} subscribed to ${channel}`)
        break

      case 'compliance':
        // Only allow compliance/admins to subscribe
        if (user.role !== 'compliance' && user.role !== 'admin') {
          throw new Error('Unauthorized subscription')
        }
        socket.join('compliance:alerts')
        socket.join('compliance:monitoring')
        logger.info(`User ${user.id} subscribed to compliance channels`)
        break

      default:
        throw new Error(`Unknown channel: ${channel}`)
    }

    // Send subscription confirmation
    socket.emit('subscription:confirmed', {
      channel,
      params,
      timestamp: new Date().toISOString(),
    })
  }

  private initializeRedisSubscriptions(): void {
    // Subscribe to Redis channels for pub/sub
    const channels = [
      'balance:updates',
      'transaction:updates',
      'compliance:alerts',
      'market:updates',
      'system:notifications',
    ]

    channels.forEach((channel) => {
      this.redis.subscribe(channel, (err, count) => {
        if (err) {
          logger.error(`Failed to subscribe to Redis channel ${channel}:`, err)
        } else {
          logger.info(`Subscribed to Redis channel: ${channel} (${count} total subscriptions)`)
        }
      })
    })

    // Handle Redis messages
    this.redis.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message)
        this.broadcastToChannel(channel, data)
      } catch (error) {
        logger.error(`Failed to parse Redis message from channel ${channel}:`, error)
      }
    })
  }

  private broadcastToChannel(channel: string, data: any): void {
    switch (channel) {
      case 'balance:updates':
        const { userId, balances } = data
        this.io.to(`balance:${userId}:all`).emit('balance:update', balances)
        Object.keys(balances).forEach((currency) => {
          this.io.to(`balance:${userId}:${currency}`).emit('balance:update', {
            [currency]: balances[currency],
          })
        })
        break

      case 'transaction:updates':
        const { transaction, userId: txUserId } = data
        // Send to user's transaction channel
        this.io.to(`transactions:${txUserId}`).emit('transaction:new', transaction)
        // Send to specific type channel
        this.io.to(`transactions:${txUserId}:${transaction.type}`).emit('transaction:new', transaction)
        // Send to streaming channel
        this.io.to(`transactions:stream:${txUserId}`).emit('transaction:stream', transaction)
        break

      case 'compliance:alerts':
        // Only send to compliance/admins
        this.io.to('compliance:alerts').emit('compliance:alert', data)
        break

      case 'market:updates':
        const { pair, price } = data
        this.io.to(`market:${pair}`).emit('market:update', { pair, price })
        break

      case 'system:notifications':
        const { type, message, userId: notifyUserId } = data
        if (notifyUserId) {
          // Personal notification
          this.io.to(`user:${notifyUserId}`).emit('notification', { type, message })
        } else {
          // Broadcast notification
          this.io.emit('notification', { type, message })
        }
        break
    }
  }

  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data)
  }

  public emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data)
  }

  public broadcast(event: string, data: any): void {
    this.io.emit(event, data)
  }

  public getConnectedUsers(): number {
    return this.io.engine.clientsCount
  }

  public getSocketCount(): number {
    return this.io.sockets.sockets.size
  }

  public async close(): Promise<void> {
    await this.redis.quit()
    this.io.close()
  }
}

export default WebSocketServer
