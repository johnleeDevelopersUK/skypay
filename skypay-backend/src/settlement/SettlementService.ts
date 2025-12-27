// skypay-backend/src/settlement/SettlementService.ts
import { PrismaClient, Settlement, SettlementState, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { LedgerService } from '../ledger/LedgerService';
import { ComplianceService } from '../compliance/ComplianceService';
import { BridgeService } from '../integrations/bridge/BridgeService';
import { Web3Service } from '../services/Web3Service';

export interface CreateSettlementParams {
  userId: string;
  type: 'FIAT_TO_TOKEN' | 'TOKEN_TO_FIAT' | 'CROSS_BORDER' | 'INTERNAL_TRANSFER';
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  provider: string;
  metadata?: any;
}

export class SettlementService {
  private stateMachine: Map<SettlementState, SettlementState[]>;

  constructor(
    private prisma: PrismaClient,
    private ledgerService: LedgerService,
    private complianceService: ComplianceService,
    private bridgeService: BridgeService,
    private web3Service: Web3Service
  ) {
    // Define valid state transitions
    this.stateMachine = new Map([
      ['INITIATED', ['FIAT_RECEIVED', 'TOKEN_LOCKED', 'FAILED']],
      ['FIAT_RECEIVED', ['FIAT_CONFIRMED', 'FAILED']],
      ['FIAT_CONFIRMED', ['TOKEN_MINTED', 'FAILED']],
      ['TOKEN_MINTED', ['TOKEN_DELIVERED', 'FAILED']],
      ['TOKEN_DELIVERED', ['SETTLED']],
      ['TOKEN_LOCKED', ['TOKEN_BURNED', 'FAILED']],
      ['TOKEN_BURNED', ['FIAT_REQUESTED', 'FAILED']],
      ['FIAT_REQUESTED', ['FIAT_SENT', 'FAILED']],
      ['FIAT_SENT', ['CONFIRMED']],
      ['SETTLED', []],
      ['CONFIRMED', []],
      ['FAILED', ['REVERSED']],
      ['REVERSED', []],
    ]);
  }

  /**
   * Create a new settlement
   */
  async createSettlement(params: CreateSettlementParams): Promise<Settlement> {
    // Validate user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      include: { accounts: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('User account is not active', 403);
    }

    // Check daily/monthly limits
    await this.checkUserLimits(user.id, params.sourceAmount, params.sourceCurrency);

    // Create settlement
    const settlement = await this.prisma.settlement.create({
      data: {
        type: params.type,
        currentState: 'INITIATED',
        userId: params.userId,
        sourceAmount: params.sourceAmount,
        sourceCurrency: params.sourceCurrency,
        targetAmount: params.targetAmount,
        targetCurrency: params.targetCurrency,
        provider: params.provider,
        metadata: params.metadata || {},
      },
    });

    // Create state history entry
    await this.prisma.settlementStateHistory.create({
      data: {
        settlementId: settlement.id,
        toState: 'INITIATED',
        metadata: { ...params.metadata, createdAt: new Date().toISOString() },
      },
    });

    logger.info(`Settlement created: ${settlement.id}`, {
      userId: params.userId,
      type: params.type,
      amount: params.sourceAmount,
      currency: params.sourceCurrency,
    });

    // Trigger initial compliance check
    await this.triggerComplianceCheck(settlement.id);

    return settlement;
  }

  /**
   * Transition settlement to next state
   */
  async transitionState(
    settlementId: string,
    targetState: SettlementState,
    metadata?: any
  ): Promise<Settlement> {
    return this.prisma.$transaction(async (tx) => {
      // Get current settlement state
      const settlement = await tx.settlement.findUnique({
        where: { id: settlementId },
      });

      if (!settlement) {
        throw new AppError('Settlement not found', 404);
      }

      // Validate state transition
      if (!this.canTransition(settlement.currentState, targetState)) {
        throw new AppError(
          `Invalid state transition: ${settlement.currentState} -> ${targetState}`,
          400
        );
      }

      // Execute state-specific logic
      await this.executeStateAction(tx, settlement, targetState, metadata);

      // Update settlement state
      const updatedSettlement = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          previousState: settlement.currentState,
          currentState: targetState,
          updatedAt: new Date(),
          metadata: metadata
            ? { ...(settlement.metadata as any), ...metadata }
            : settlement.metadata,
          ...(targetState === 'SETTLED' || targetState === 'CONFIRMED') && {
            completedAt: new Date(),
          },
          ...(targetState === 'FAILED') && {
            failedAt: new Date(),
            failureReason: metadata?.reason || 'Unknown error',
          },
        },
      });

      // Create state history entry
      await tx.settlementStateHistory.create({
        data: {
          settlementId: settlement.id,
          fromState: settlement.currentState,
          toState: targetState,
          reason: metadata?.reason,
          metadata: metadata || {},
        },
      });

      logger.info(`Settlement state transition: ${settlementId}`, {
        from: settlement.currentState,
        to: targetState,
        userId: settlement.userId,
      });

      // Trigger next step if applicable
      if (this.shouldTriggerNextStep(targetState)) {
        await this.triggerNextStep(settlementId, targetState, metadata);
      }

      return updatedSettlement;
    });
  }

  /**
   * Execute state-specific actions
   */
  private async executeStateAction(
    tx: Prisma.TransactionClient,
    settlement: Settlement,
    targetState: SettlementState,
    metadata?: any
  ): Promise<void> {
    switch (targetState) {
      case 'FIAT_RECEIVED':
        await this.handleFiatReceived(tx, settlement, metadata);
        break;
      case 'TOKEN_MINTED':
        await this.handleTokenMinted(tx, settlement, metadata);
        break;
      case 'TOKEN_LOCKED':
        await this.handleTokenLocked(tx, settlement, metadata);
        break;
      case 'TOKEN_BURNED':
        await this.handleTokenBurned(tx, settlement, metadata);
        break;
      case 'FIAT_REQUESTED':
        await this.handleFiatRequested(tx, settlement, metadata);
        break;
      case 'SETTLED':
        await this.handleSettled(tx, settlement, metadata);
        break;
      case 'CONFIRMED':
        await this.handleConfirmed(tx, settlement, metadata);
        break;
      case 'FAILED':
        await this.handleFailed(tx, settlement, metadata);
        break;
    }
  }

  /**
   * Handle fiat received from Bridge
   */
  private async handleFiatReceived(
    tx: Prisma.TransactionClient,
    settlement: Settlement,
    metadata: any
  ): Promise<void> {
    const { bridgeTransactionId, amount, currency } = metadata;

    // Find or create fiat account
    const account = await this.getOrCreateAccount(
      tx,
      settlement.userId,
      'FIAT',
      currency,
      'BRIDGE'
    );

    // Create ledger entry for fiat deposit
    await this.ledgerService.createLedgerEntry({
      accountId: account.id,
      type: 'DEPOSIT',
      amount,
      currency,
      direction: 'CREDIT',
      referenceId: bridgeTransactionId,
      settlementId: settlement.id,
      metadata: {
        bridgeTransactionId,
        settlementId: settlement.id,
        provider: 'BRIDGE',
      },
      description: `Fiat deposit via Bridge`,
    });

    logger.info(`Fiat received for settlement: ${settlement.id}`, {
      amount,
      currency,
      bridgeTransactionId,
    });
  }

  /**
   * Handle token minting on blockchain
   */
  private async handleTokenMinted(
    tx: Prisma.TransactionClient,
    settlement: Settlement,
    metadata: any
  ): Promise<void> {
    const { transactionHash, amount, currency } = metadata;
    const tokenCurrency = settlement.targetCurrency;

    // Find or create token account
    const account = await this.getOrCreateAccount(
      tx,
      settlement.userId,
      'TOKEN',
      tokenCurrency,
      'BLOCKCHAIN'
    );

    // Create ledger entry for token mint
    await this.ledgerService.createLedgerEntry({
      accountId: account.id,
      type: 'MINT',
      amount,
      currency: tokenCurrency,
      direction: 'CREDIT',
      referenceId: transactionHash,
      settlementId: settlement.id,
      metadata: {
        transactionHash,
        settlementId: settlement.id,
        contractAddress: metadata.contractAddress,
      },
      description: `Token mint for settlement`,
    });

    logger.info(`Tokens minted for settlement: ${settlement.id}`, {
      amount,
      currency: tokenCurrency,
      transactionHash,
    });
  }

  /**
   * Handle token locking for withdrawal
   */
  private async handleTokenLocked(
    tx: Prisma.TransactionClient,
    settlement: Settlement,
    metadata: any
  ): Promise<void> {
    // Lock tokens in user's account (move from available to pending)
    const account = await tx.account.findFirst({
      where: {
        userId: settlement.userId,
        type: 'TOKEN',
        currency: settlement.sourceCurrency,
      },
    });

    if (!account) {
      throw new AppError('Token account not found', 404);
    }

    if (account.available.lessThan(settlement.sourceAmount)) {
      throw new AppError('Insufficient available tokens', 400);
    }

    await tx.account.update({
      where: { id: account.id },
      data: {
        available: { decrement: settlement.sourceAmount },
        pending: { increment: settlement.sourceAmount },
      },
    });

    logger.info(`Tokens locked for settlement: ${settlement.id}`, {
      amount: settlement.sourceAmount,
      currency: settlement.sourceCurrency,
    });
  }

  /**
   * Get or create user account
   */
  private async getOrCreateAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    type: 'FIAT' | 'TOKEN',
    currency: string,
    provider: string
  ): Promise<any> {
    let account = await tx.account.findUnique({
      where: {
        userId_type_currency: {
          userId,
          type,
          currency,
        },
      },
    });

    if (!account) {
      account = await tx.account.create({
        data: {
          userId,
          type,
          currency,
          provider,
          balance: 0,
          available: 0,
          pending: 0,
          frozen: false,
        },
      });
    }

    return account;
  }

  /**
   * Check if state transition is valid
   */
  private canTransition(from: SettlementState, to: SettlementState): boolean {
    const validTransitions = this.stateMachine.get(from);
    return validTransitions ? validTransitions.includes(to) : false;
  }

  /**
   * Check if next step should be triggered
   */
  private shouldTriggerNextStep(state: SettlementState): boolean {
    const autoTriggerStates: SettlementState[] = [
      'FIAT_RECEIVED',
      'FIAT_CONFIRMED',
      'TOKEN_MINTED',
      'TOKEN_BURNED',
      'FIAT_REQUESTED',
    ];
    return autoTriggerStates.includes(state);
  }

  /**
   * Trigger next step in settlement
   */
  private async triggerNextStep(
    settlementId: string,
    currentState: SettlementState,
    metadata?: any
  ): Promise<void> {
    // This would be implemented based on settlement type and state
    // For now, we'll just log it
    logger.info(`Triggering next step for settlement: ${settlementId}`, {
      currentState,
      metadata,
    });
  }

  /**
   * Check user limits before settlement
   */
  private async checkUserLimits(
    userId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Reset daily spent if new day
    const lastReset = user.lastActivity || user.createdAt;
    const isNewDay = new Date().getDate() !== lastReset.getDate();

    let dailySpent = isNewDay ? 0 : user.dailySpent.toNumber();
    let monthlySpent = isNewDay ? 0 : user.monthlySpent.toNumber();

    // Check daily limit
    if (dailySpent + amount > user.dailyLimit.toNumber()) {
      throw new AppError('Daily limit exceeded', 400);
    }

    // Check monthly limit
    if (monthlySpent + amount > user.monthlyLimit.toNumber()) {
      throw new AppError('Monthly limit exceeded', 400);
    }
  }

  /**
   * Trigger compliance check for settlement
   */
  private async triggerComplianceCheck(settlementId: string): Promise<void> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { user: true },
    });

    if (!settlement) {
      throw new AppError('Settlement not found', 404);
    }

    // Run compliance check
    const complianceCheck = await this.complianceService.checkTransaction({
      userId: settlement.userId,
      settlementId: settlement.id,
      type: settlement.type as any,
      amount: settlement.sourceAmount.toNumber(),
      currency: settlement.sourceCurrency,
      targetAmount: settlement.targetAmount.toNumber(),
      targetCurrency: settlement.targetCurrency,
    });

    // Update settlement with compliance results
    await this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        complianceCheckId: complianceCheck.id,
        riskScore: complianceCheck.riskScore,
        riskLevel: complianceCheck.riskLevel,
      },
    });

    // If compliance check fails, fail the settlement
    if (!complianceCheck.approved) {
      await this.transitionState(settlementId, 'FAILED', {
        reason: `Compliance check failed: ${complianceCheck.reason}`,
      });
    }
  }

  /**
   * Get settlement by ID with full details
   */
  async getSettlementDetails(settlementId: string): Promise<any> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            country: true,
            verificationLevel: true,
          },
        },
        sourceAccount: true,
        targetAccount: true,
        ledgerEntries: true,
        transactions: true,
        complianceCheck: true,
        stateHistory: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!settlement) {
      throw new AppError('Settlement not found', 404);
    }

    return settlement;
  }

  /**
   * Get user settlements with pagination
   */
  async getUserSettlements(
    userId: string,
    filters: {
      type?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ settlements: Settlement[]; total: number }> {
    const where: Prisma.SettlementWhereInput = {
      userId,
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { currentState: filters.status }),
      ...(filters.startDate || filters.endDate) && {
        createdAt: {
          ...(filters.startDate && { gte: filters.startDate }),
          ...(filters.endDate && { lte: filters.endDate }),
        },
      },
    };

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 20,
        skip: filters.offset || 0,
        include: {
          ledgerEntries: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { settlements, total };
  }
}
