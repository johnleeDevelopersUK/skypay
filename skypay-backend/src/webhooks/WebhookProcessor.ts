// skypay-backend/src/webhooks/WebhookProcessor.ts
import { Queue } from 'bull';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { BridgeService } from '../integrations/bridge/BridgeService';
import { Web3Service } from '../services/Web3Service';

export class WebhookProcessor {
  private queue: Queue;
  private bridgeService: BridgeService;
  private web3Service: Web3Service;
  private prisma: PrismaClient;

  constructor() {
    this.queue = new Queue('webhooks', {
      redis: process.env.REDIS_URL,
    });

    this.prisma = new PrismaClient();
    this.bridgeService = new BridgeService(this.prisma);
    this.web3Service = new Web3Service();
  }

  /**
   * Process webhook event
   */
  async process(event: string, payload: any): Promise<boolean> {
    try {
      logger.info(`Processing webhook event: ${event}`, { payload });

      // Add to processing queue
      await this.queue.add(event, payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      });

      // Also process immediately for critical events
      await this.processImmediately(event, payload);

      return true;
    } catch (error) {
      logger.error(`Failed to process webhook event ${event}:`, error);
      return false;
    }
  }

  /**
   * Process immediate webhook events
   */
  private async processImmediately(event: string, payload: any): Promise<void> {
    const [source, action] = event.split('.');

    switch (source) {
      case 'bridge':
        await this.bridgeService.handleWebhookEvent(action, payload);
        break;

      case 'blockchain':
        await this.handleBlockchainEvent(action, payload);
        break;

      case 'paystack':
        await this.handlePaystackEvent(action, payload);
        break;

      case 'stripe':
        await this.handleStripeEvent(action, payload);
        break;

      case 'mtn':
        await this.handleMtnEvent(action, payload);
        break;

      case 'airtel':
        await this.handleAirtelEvent(action, payload);
        break;

      default:
        logger.warn(`Unhandled webhook source: ${source}`);
    }
  }

  /**
   * Handle blockchain events
   */
  private async handleBlockchainEvent(action: string, payload: any): Promise<void> {
    switch (action) {
      case 'token_minted':
        await this.handleTokenMinted(payload);
        break;

      case 'token_burned':
        await this.handleTokenBurned(payload);
        break;

      case 'transfer':
        await this.handleTokenTransfer(payload);
        break;

      default:
        logger.warn(`Unhandled blockchain event: ${action}`);
    }
  }

  /**
   * Handle token minting event
   */
  private async handleTokenMinted(payload: any): Promise<void> {
    const { transactionHash, from, to, amount, settlementId } = payload;

    await this.prisma.$transaction(async (tx) => {
      // Find settlement by ID or reference
      const settlement = await tx.settlement.findFirst({
        where: {
          OR: [
            { id: settlementId },
            { providerReference: transactionHash },
          ],
        },
      });

      if (!settlement) {
        logger.error(`Settlement not found for mint event: ${settlementId}`);
        return;
      }

      // Update settlement state
      await tx.settlement.update({
        where: { id: settlement.id },
        data: {
          currentState: 'TOKEN_MINTED',
          metadata: {
            ...(settlement.metadata as any),
            mintTransactionHash: transactionHash,
            mintedAt: new Date().toISOString(),
          },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          type: 'MINT',
          userId: settlement.userId,
          settlementId: settlement.id,
          amount: parseFloat(amount),
          currency: settlement.targetCurrency,
          feeAmount: 0,
          netAmount: parseFloat(amount),
          fromAddress: from,
          toAddress: to,
          chainId: 137, // Polygon
          txHash: transactionHash,
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: {
            event: 'token_minted',
            ...payload,
          },
        },
      });

      logger.info(`Token minted for settlement: ${settlement.id}`, {
        transactionHash,
        amount,
      });
    });
  }

  /**
   * Handle token burn event
   */
  private async handleTokenBurned(payload: any): Promise<void> {
    const { transactionHash, from, amount, settlementId } = payload;

    await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.findFirst({
        where: {
          OR: [
            { id: settlementId },
            { providerReference: transactionHash },
          ],
        },
      });

      if (!settlement) {
        logger.error(`Settlement not found for burn event: ${settlementId}`);
        return;
      }

      await tx.settlement.update({
        where: { id: settlement.id },
        data: {
          currentState: 'TOKEN_BURNED',
          metadata: {
            ...(settlement.metadata as any),
            burnTransactionHash: transactionHash,
            burnedAt: new Date().toISOString(),
          },
        },
      });

      logger.info(`Token burned for settlement: ${settlement.id}`, {
        transactionHash,
        amount,
      });
    });
  }

  /**
   * Handle payment provider events
   */
  private async handlePaystackEvent(action: string, payload: any): Promise<void> {
    // Implementation for Paystack integration
    logger.info(`Processing Paystack event: ${action}`, payload);
  }

  private async handleStripeEvent(action: string, payload: any): Promise<void> {
    // Implementation for Stripe integration
    logger.info(`Processing Stripe event: ${action}`, payload);
  }

  private async handleMtnEvent(action: string, payload: any): Promise<void> {
    // Implementation for MTN Mobile Money
    logger.info(`Processing MTN event: ${action}`, payload);
  }

  private async handleAirtelEvent(action: string, payload: any): Promise<void> {
    // Implementation for Airtel Money
    logger.info(`Processing Airtel event: ${action}`, payload);
  }

  /**
   * Setup webhook queue processing
   */
  async setupQueueProcessing(): Promise<void> {
    this.queue.process('*', async (job) => {
      const { event, payload } = job.data;
      
      try {
        await this.processImmediately(event, payload);
        logger.info(`Successfully processed queued webhook: ${event}`);
      } catch (error) {
        logger.error(`Failed to process queued webhook ${event}:`, error);
        throw error; // Will trigger retry
      }
    });

    // Handle queue events
    this.queue.on('completed', (job) => {
      logger.debug(`Webhook job completed: ${job.id} - ${job.data.event}`);
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`Webhook job failed: ${job?.id} - ${job?.data?.event}`, error);
    });
  }

  /**
   * Cleanup old webhook jobs
   */
  async cleanupOldJobs(days: number = 7): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const jobs = await this.queue.getJobs(['completed', 'failed']);
    const oldJobs = jobs.filter(job => job.finishedOn && job.finishedOn < cutoff.getTime());

    for (const job of oldJobs) {
      await job.remove();
    }

    logger.info(`Cleaned up ${oldJobs.length} old webhook jobs`);
  }
}
