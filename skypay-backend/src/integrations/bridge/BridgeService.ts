// skypay-backend/src/integrations/bridge/BridgeService.ts
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { PrismaClient } from '@prisma/client';

export interface BridgeDepositParams {
  settlementId: string;
  amount: number;
  currency: string;
  userId: string;
  bankDetails?: any;
  metadata?: any;
}

export interface BridgeWithdrawalParams {
  settlementId: string;
  amount: number;
  currency: string;
  userId: string;
  bankDetails: any;
  metadata?: any;
}

export class BridgeService {
  private client: any;
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(private prisma: PrismaClient) {
    this.baseUrl = config.integrations.bridge.baseUrl;
    this.apiKey = config.integrations.bridge.apiKey;
    this.apiSecret = config.integrations.bridge.apiSecret;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    // Add request interceptor for signing
    this.client.interceptors.request.use((request: any) => {
      if (request.method === 'post' || request.method === 'put') {
        const timestamp = Date.now();
        const signature = this.generateSignature(
          request.method,
          request.url,
          timestamp,
          request.data
        );
        
        request.headers['X-Timestamp'] = timestamp;
        request.headers['X-Signature'] = signature;
      }
      return request;
    });
  }

  /**
   * Generate API signature
   */
  private generateSignature(
    method: string,
    endpoint: string,
    timestamp: number,
    body: any = {}
  ): string {
    const payload = JSON.stringify(body);
    const message = `${method.toUpperCase()}|${endpoint}|${timestamp}|${payload}`;
    
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate deposit instructions for user
   */
  async generateDepositInstructions(
    params: BridgeDepositParams
  ): Promise<any> {
    try {
      // Get supported banks for user's country
      const banksResponse = await this.client.get('/v1/banks', {
        params: {
          country: 'NG', // Default to Nigeria, would be dynamic in production
          currency: params.currency,
        },
      });

      // Create deposit order in Bridge
      const depositResponse = await this.client.post('/v1/deposits', {
        external_reference: params.settlementId,
        amount: params.amount,
        currency: params.currency,
        user_id: params.userId,
        metadata: {
          ...params.metadata,
          settlement_type: 'FIAT_TO_TOKEN',
          bank_details: params.bankDetails,
        },
        callback_url: `${config.baseUrl}/api/v1/webhooks/bridge`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Update settlement with Bridge reference
      await this.prisma.settlement.update({
        where: { id: params.settlementId },
        data: {
          providerReference: depositResponse.data.id,
          metadata: {
            ...(params.metadata || {}),
            bridge_deposit_id: depositResponse.data.id,
            deposit_instructions: depositResponse.data.instructions,
          },
        },
      });

      logger.info(`Bridge deposit created: ${params.settlementId}`, {
        bridgeId: depositResponse.data.id,
        amount: params.amount,
        currency: params.currency,
      });

      return {
        instructions: depositResponse.data.instructions,
        reference: depositResponse.data.reference,
        expiresAt: depositResponse.data.expires_at,
        bankDetails: banksResponse.data.banks[0], // First bank
      };
    } catch (error: any) {
      logger.error('Bridge deposit creation failed:', error);
      throw new AppError(
        `Failed to create deposit: ${error.response?.data?.message || error.message}`,
        500
      );
    }
  }

  /**
   * Initiate withdrawal via Bridge
   */
  async initiateWithdrawal(params: BridgeWithdrawalParams): Promise<any> {
    try {
      // Create withdrawal order in Bridge
      const withdrawalResponse = await this.client.post('/v1/withdrawals', {
        external_reference: params.settlementId,
        amount: params.amount,
        currency: params.currency,
        beneficiary: {
          name: params.bankDetails.accountName,
          bank_code: params.bankDetails.bankCode,
          account_number: params.bankDetails.accountNumber,
          account_type: params.bankDetails.accountType || 'SAVINGS',
        },
        metadata: {
          ...params.metadata,
          settlement_type: 'TOKEN_TO_FIAT',
          user_id: params.userId,
        },
        callback_url: `${config.baseUrl}/api/v1/webhooks/bridge`,
      });

      // Update settlement with Bridge reference
      await this.prisma.settlement.update({
        where: { id: params.settlementId },
        data: {
          providerReference: withdrawalResponse.data.id,
          metadata: {
            ...(params.metadata || {}),
            bridge_withdrawal_id: withdrawalResponse.data.id,
            withdrawal_status: withdrawalResponse.data.status,
          },
        },
      });

      logger.info(`Bridge withdrawal created: ${params.settlementId}`, {
        bridgeId: withdrawalResponse.data.id,
        amount: params.amount,
        currency: params.currency,
      });

      return {
        withdrawalId: withdrawalResponse.data.id,
        status: withdrawalResponse.data.status,
        estimatedCompletion: withdrawalResponse.data.estimated_completion,
        fees: withdrawalResponse.data.fees,
      };
    } catch (error: any) {
      logger.error('Bridge withdrawal creation failed:', error);
      throw new AppError(
        `Failed to create withdrawal: ${error.response?.data?.message || error.message}`,
        500
      );
    }
  }

  /**
   * Get deposit status
   */
  async getDepositStatus(bridgeId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/deposits/${bridgeId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Bridge deposit status check failed:', error);
      throw new AppError(
        `Failed to get deposit status: ${error.response?.data?.message || error.message}`,
        500
      );
    }
  }

  /**
   * Get withdrawal status
   */
  async getWithdrawalStatus(bridgeId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/withdrawals/${bridgeId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Bridge withdrawal status check failed:', error);
      throw new AppError(
        `Failed to get withdrawal status: ${error.response?.data?.message || error.message}`,
        500
      );
    }
  }

  /**
   * Handle Bridge webhook events
   */
  async handleWebhookEvent(event: string, data: any): Promise<boolean> {
    try {
      logger.info(`Processing Bridge webhook: ${event}`, data);

      switch (event) {
        case 'deposit.completed':
          await this.handleDepositCompleted(data);
          break;

        case 'deposit.failed':
          await this.handleDepositFailed(data);
          break;

        case 'withdrawal.completed':
          await this.handleWithdrawalCompleted(data);
          break;

        case 'withdrawal.failed':
          await this.handleWithdrawalFailed(data);
          break;

        case 'withdrawal.processing':
          await this.handleWithdrawalProcessing(data);
          break;

        default:
          logger.warn(`Unhandled Bridge webhook event: ${event}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to process Bridge webhook ${event}:`, error);
      return false;
    }
  }

  /**
   * Handle completed deposit
   */
  private async handleDepositCompleted(data: any): Promise<void> {
    const { external_reference: settlementId, amount, currency, id: bridgeId } = data;

    // Update settlement state
    await this.prisma.$transaction(async (tx) => {
      // Update settlement
      const settlement = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          currentState: 'FIAT_RECEIVED',
          metadata: {
            ...(data.metadata || {}),
            fiatReceivedAt: new Date().toISOString(),
            bridgeTransactionId: bridgeId,
          },
        },
        include: { user: true },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          type: 'SETTLEMENT_UPDATED',
          userId: settlement.userId,
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          changes: {
            state: 'FIAT_RECEIVED',
            bridgeId,
            amount,
            currency,
          },
          metadata: { webhook: true, event: 'deposit.completed' },
        },
      });

      // Create ledger entry (handled by settlement service)
      logger.info(`Deposit completed for settlement: ${settlementId}`, {
        bridgeId,
        amount,
        currency,
      });
    });
  }

  /**
   * Handle deposit failure
   */
  private async handleDepositFailed(data: any): Promise<void> {
    const { external_reference: settlementId, failure_reason, id: bridgeId } = data;

    await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          currentState: 'FAILED',
          failureReason: failure_reason || 'Bridge deposit failed',
          metadata: {
            ...(data.metadata || {}),
            failedAt: new Date().toISOString(),
            bridgeTransactionId: bridgeId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          type: 'SETTLEMENT_UPDATED',
          userId: settlement.userId,
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          changes: {
            state: 'FAILED',
            reason: failure_reason,
          },
          metadata: { webhook: true, event: 'deposit.failed' },
        },
      });
    });
  }

  /**
   * Handle withdrawal completion
   */
  private async handleWithdrawalCompleted(data: any): Promise<void> {
    const { external_reference: settlementId, id: bridgeId } = data;

    await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          currentState: 'CONFIRMED',
          completedAt: new Date(),
          metadata: {
            ...(data.metadata || {}),
            fiatSentAt: new Date().toISOString(),
            bridgeTransactionId: bridgeId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          type: 'SETTLEMENT_UPDATED',
          userId: settlement.userId,
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          changes: {
            state: 'CONFIRMED',
            bridgeId,
          },
          metadata: { webhook: true, event: 'withdrawal.completed' },
        },
      });
    });
  }

  /**
   * Get available corridors
   */
  async getAvailableCorridors(): Promise<any> {
    try {
      const response = await this.client.get('/v1/corridors');
      return response.data.corridors;
    } catch (error: any) {
      logger.error('Failed to fetch corridors:', error);
      throw new AppError('Failed to fetch available corridors', 500);
    }
  }

  /**
   * Get supported banks
   */
  async getSupportedBanks(country: string, currency: string): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/banks', {
        params: { country, currency },
      });
      return response.data.banks;
    } catch (error: any) {
      logger.error('Failed to fetch banks:', error);
      throw new AppError('Failed to fetch supported banks', 500);
    }
  }

  /**
   * Validate bank account
   */
  async validateBankAccount(
    bankCode: string,
    accountNumber: string
  ): Promise<any> {
    try {
      const response = await this.client.post('/v1/accounts/validate', {
        bank_code: bankCode,
        account_number: accountNumber,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to validate account:', error);
      throw new AppError('Failed to validate bank account', 500);
    }
  }

  /**
   * Get transaction limits
   */
  async getTransactionLimits(
    fromCurrency: string,
    toCurrency: string
  ): Promise<any> {
    try {
      const response = await this.client.get('/v1/limits', {
        params: { from_currency: fromCurrency, to_currency: toCurrency },
      });
      return response.data.limits;
    } catch (error: any) {
      logger.error('Failed to fetch limits:', error);
      return {
        minAmount: 1,
        maxAmount: 10000,
        dailyLimit: 50000,
        monthlyLimit: 150000,
      };
    }
  }
}
