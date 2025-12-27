import nodemailer from 'nodemailer'
import twilio from 'twilio'
import { Expo } from 'expo-server-sdk'
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import Queue from 'bull'
import { logger } from '../config/logger'
import { User } from '../entities/User'

export enum NotificationType {
  TRANSACTION = 'transaction',
  SECURITY = 'security',
  KYC = 'kyc',
  COMPLIANCE = 'compliance',
  MARKETING = 'marketing',
  SYSTEM = 'system',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  channels: NotificationChannel[]
  priority?: 'low' | 'normal' | 'high'
  scheduledAt?: Date
}

export class NotificationService {
  private static instance: NotificationService
  private emailTransporter: nodemailer.Transporter
  private smsClient: twilio.Twilio
  private expoClient: Expo
  private notificationQueue: Queue.Queue

  private constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    // Initialize SMS client
    this.smsClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    // Initialize Expo push notification client
    this.expoClient = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    })

    // Initialize Bull queue for notifications
    this.notificationQueue = new Queue('notifications', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    })

    this.setupQueueProcessors()
    this.setupBullBoard()
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private setupQueueProcessors(): void {
    // Process notification jobs
    this.notificationQueue.process('send', async (job) => {
      const { payload } = job.data
      await this.sendNotification(payload)
    })

    // Process bulk notification jobs
    this.notificationQueue.process('bulk', async (job) => {
      const { payloads } = job.data
      await Promise.all(payloads.map((payload: NotificationPayload) => 
        this.sendNotification(payload)
      ))
    })

    // Process scheduled notifications
    this.notificationQueue.process('scheduled', async (job) => {
      const { payload } = job.data
      await this.sendNotification(payload)
    })

    // Handle failed jobs
    this.notificationQueue.on('failed', (job, error) => {
      logger.error('Notification job failed', {
        jobId: job?.id,
        error: error.message,
        payload: job?.data,
      })
    })

    // Handle completed jobs
    this.notificationQueue.on('completed', (job) => {
      logger.info('Notification job completed', {
        jobId: job.id,
        payload: job.data,
      })
    })
  }

  private setupBullBoard(): void {
    const serverAdapter = new ExpressAdapter()
    serverAdapter.setBasePath('/admin/queues')

    createBullBoard({
      queues: [new BullAdapter(this.notificationQueue)],
      serverAdapter,
    })
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const user = await this.getUser(payload.userId)
      if (!user) {
        throw new Error(`User ${payload.userId} not found`)
      }

      // Check user preferences
      const preferences = user.preferences?.notifications || {
        email: true,
        sms: true,
        push: true,
      }

      // Send notifications through enabled channels
      const promises = payload.channels.map(async (channel) => {
        if (!preferences[channel]) {
          logger.info(`Notification channel ${channel} disabled for user ${user.id}`)
          return
        }

        switch (channel) {
          case NotificationChannel.EMAIL:
            await this.sendEmail(user, payload)
            break
          case NotificationChannel.SMS:
            await this.sendSMS(user, payload)
            break
          case NotificationChannel.PUSH:
            await this.sendPushNotification(user, payload)
            break
          case NotificationChannel.IN_APP:
            await this.sendInAppNotification(user, payload)
            break
        }
      })

      await Promise.allSettled(promises)

      // Log notification
      logger.info('Notification sent successfully', {
        userId: user.id,
        type: payload.type,
        channels: payload.channels,
      })
    } catch (error) {
      logger.error('Failed to send notification', {
        error: error.message,
        payload,
      })
      throw error
    }
  }

  async sendEmail(user: User, payload: NotificationPayload): Promise<void> {
    const template = this.getEmailTemplate(payload.type, payload.data)

    const mailOptions = {
      from: `"SkyPay" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: payload.title,
      html: template,
      text: payload.message,
    }

    await this.emailTransporter.sendMail(mailOptions)
  }

  async sendSMS(user: User, payload: NotificationPayload): Promise<void> {
    if (!user.phone) {
      throw new Error('User phone number not available')
    }

    await this.smsClient.messages.create({
      body: `${payload.title}: ${payload.message}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phone,
    })
  }

  async sendPushNotification(user: User, payload: NotificationPayload): Promise<void> {
    // Get user's push tokens from database
    const pushTokens = await this.getUserPushTokens(user.id)
    
    if (pushTokens.length === 0) {
      logger.info(`No push tokens found for user ${user.id}`)
      return
    }

    const messages = pushTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: payload.title,
        body: payload.message,
        data: payload.data,
        priority: payload.priority === 'high' ? 'high' : 'normal',
      }))

    // Send push notifications in chunks
    const chunks = this.expoClient.chunkPushNotifications(messages)
    
    for (const chunk of chunks) {
      try {
        const receipts = await this.expoClient.sendPushNotificationsAsync(chunk)
        receipts.forEach((receipt, index) => {
          if (receipt.status === 'error') {
            logger.error('Push notification failed', {
              token: messages[index].to,
              error: receipt.message,
            })
          }
        })
      } catch (error) {
        logger.error('Failed to send push notifications', { error: error.message })
      }
    }
  }

  async sendInAppNotification(user: User, payload: NotificationPayload): Promise<void> {
    // Store notification in database for in-app display
    await this.storeInAppNotification(user.id, payload)
    
    // Send WebSocket notification for real-time updates
    await this.sendWebSocketNotification(user.id, payload)
  }

  async queueNotification(payload: NotificationPayload): Promise<void> {
    const jobOptions: any = {
      priority: this.getJobPriority(payload.priority),
    }

    if (payload.scheduledAt) {
      jobOptions.delay = payload.scheduledAt.getTime() - Date.now()
    }

    await this.notificationQueue.add('send', { payload }, jobOptions)
  }

  async queueBulkNotifications(payloads: NotificationPayload[]): Promise<void> {
    await this.notificationQueue.add('bulk', { payloads })
  }

  async sendTransactionNotification(
    userId: string,
    transaction: any,
    channel: NotificationChannel
  ): Promise<void> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.TRANSACTION,
      title: 'Transaction Update',
      message: this.getTransactionMessage(transaction),
      data: {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      },
      channels: [channel],
      priority: 'normal',
    }

    await this.queueNotification(payload)
  }

  async sendSecurityNotification(
    userId: string,
    event: string,
    details: any,
    channels: NotificationChannel[]
  ): Promise<void> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.SECURITY,
      title: 'Security Alert',
      message: `Security event detected: ${event}`,
      data: {
        event,
        details,
        timestamp: new Date().toISOString(),
        ipAddress: details.ipAddress,
        device: details.device,
      },
      channels,
      priority: 'high',
    }

    await this.queueNotification(payload)
  }

  async sendKYCNotification(
    userId: string,
    status: string,
    channels: NotificationChannel[]
  ): Promise<void> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.KYC,
      title: 'KYC Status Update',
      message: `Your KYC verification is ${status}`,
      data: {
        status,
        timestamp: new Date().toISOString(),
      },
      channels,
      priority: 'normal',
    }

    await this.queueNotification(payload)
  }

  async sendComplianceAlert(
    userId: string,
    alert: any,
    channels: NotificationChannel[]
  ): Promise<void> {
    const payload: NotificationPayload = {
      userId,
      type: NotificationType.COMPLIANCE,
      title: 'Compliance Alert',
      message: alert.message,
      data: {
        alertId: alert.id,
        type: alert.type,
        level: alert.level,
        actions: alert.actions,
      },
      channels,
      priority: 'high',
    }

    await this.queueNotification(payload)
  }

  private getEmailTemplate(type: NotificationType, data?: any): string {
    const templates: Record<NotificationType, string> = {
      [NotificationType.TRANSACTION]: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0066FF; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .transaction-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SkyPay Transaction Notification</h1>
            </div>
            <div class="content">
              <h2>Transaction ${data?.status || 'processed'}</h2>
              <div class="transaction-details">
                <p><strong>Amount:</strong> ${data?.amount || 0} ${data?.currency || ''}</p>
                <p><strong>Type:</strong> ${data?.type || ''}</p>
                <p><strong>Reference:</strong> ${data?.reference || ''}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p>If you did not initiate this transaction, please contact our support immediately.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SkyPay. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      [NotificationType.SECURITY]: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>Security Alert</h2>
          <p>A security event was detected on your account.</p>
          <p><strong>Event:</strong> ${data?.event || 'Unknown'}</p>
          <p><strong>Time:</strong> ${data?.timestamp || new Date().toISOString()}</p>
          <p>If this was not you, please secure your account immediately.</p>
        </body>
        </html>
      `,
      [NotificationType.KYC]: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>KYC Status Update</h2>
          <p>Your KYC verification status has been updated to: <strong>${data?.status || 'pending'}</strong></p>
        </body>
        </html>
      `,
      [NotificationType.COMPLIANCE]: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>Compliance Alert</h2>
          <p>A compliance alert has been triggered on your account.</p>
          <p><strong>Level:</strong> ${data?.level || 'medium'}</p>
          <p><strong>Action Required:</strong> ${data?.actions || 'Please review'}</p>
        </body>
        </html>
      `,
      [NotificationType.MARKETING]: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>SkyPay Update</h2>
          <p>${data?.message || 'Check out our latest features!'}</p>
        </body>
        </html>
      `,
      [NotificationType.SYSTEM]: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>System Notification</h2>
          <p>${data?.message || 'System update notification'}</p>
        </body>
        </html>
      `,
    }

    return templates[type] || templates[NotificationType.SYSTEM]
  }

  private getTransactionMessage(transaction: any): string {
    const messages: Record<string, string> = {
      deposit: `Deposit of ${transaction.amount} ${transaction.currency} completed`,
      withdrawal: `Withdrawal of ${transaction.amount} ${transaction.currency} processed`,
      transfer: `Transfer of ${transaction.amount} ${transaction.currency} sent`,
      swap: `Currency swap completed`,
      bridge: `Cross-chain bridge transfer completed`,
    }

    return messages[transaction.type] || `Transaction ${transaction.status}: ${transaction.amount} ${transaction.currency}`
  }

  private getJobPriority(priority?: string): number {
    switch (priority) {
      case 'high': return 1
      case 'low': return 3
      default: return 2
    }
  }

  private async getUser(userId: string): Promise<User | null> {
    // Fetch user from database
    // This would be your database query
    return null
  }

  private async getUserPushTokens(userId: string): Promise<string[]> {
    // Fetch push tokens from database
    return []
  }

  private async storeInAppNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // Store in database
  }

  private async sendWebSocketNotification(userId: string, payload: NotificationPayload): Promise<void> {
    // Send via WebSocket
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    await this.notificationQueue.close()
    logger.info('Notification service cleaned up')
  }
}
