// skypay-backend/src/ledger/LedgerService.ts
import { PrismaClient, LedgerEntry, Account, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { encryptionService } from '../services/encryption';

export interface CreateLedgerEntryParams {
  accountId: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  direction: 'CREDIT' | 'DEBIT';
  referenceId?: string;
  settlementId?: string;
  transactionId?: string;
  metadata?: any;
  description?: string;
}

export interface UpdateAccountBalanceParams {
  accountId: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  direction: 'CREDIT' | 'DEBIT';
  currency: string;
}

export class LedgerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a ledger entry with atomic balance update
   */
  async createLedgerEntry(params: CreateLedgerEntryParams): Promise<LedgerEntry> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify account exists and is not frozen
      const account = await tx.account.findUnique({
        where: { id: params.accountId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      if (account.frozen) {
        throw new AppError('Account is frozen', 403);
      }

      // 2. Update account balance
      const updatedAccount = await this.updateAccountBalance(tx, {
        accountId: params.accountId,
        amount: params.amount,
        type: params.type as any,
        direction: params.direction,
        currency: params.currency,
      });

      // 3. Create ledger entry
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          accountId: params.accountId,
          type: params.type,
          amount: params.amount,
          currency: params.currency,
          direction: params.direction,
          status: 'PENDING',
          referenceId: params.referenceId,
          settlementId: params.settlementId,
          transactionId: params.transactionId,
          metadata: params.metadata || {},
          description: params.description,
        },
      });

      logger.info(`Ledger entry created: ${ledgerEntry.id}`, {
        accountId: params.accountId,
        amount: params.amount,
        currency: params.currency,
        direction: params.direction,
      });

      return ledgerEntry;
    });
  }

  /**
   * Update account balance atomically
   */
  private async updateAccountBalance(
    tx: Prisma.TransactionClient,
    params: UpdateAccountBalanceParams
  ): Promise<Account> {
    const { accountId, amount, type, direction, currency } = params;
    const amountDecimal = new Decimal(amount);

    // Determine which balance field to update
    let updateData: Prisma.AccountUpdateInput = {};

    if (direction === 'CREDIT') {
      if (type === 'DEPOSIT') {
        // Credit to available balance
        updateData = {
          balance: { increment: amountDecimal },
          available: { increment: amountDecimal },
        };
      } else if (type === 'TRANSFER') {
        // Credit to available balance
        updateData = {
          available: { increment: amountDecimal },
        };
      }
    } else if (direction === 'DEBIT') {
      if (type === 'WITHDRAWAL') {
        // Debit from both balance and available
        updateData = {
          balance: { decrement: amountDecimal },
          available: { decrement: amountDecimal },
        };
      } else if (type === 'TRANSFER') {
        // Debit from available balance
        updateData = {
          available: { decrement: amountDecimal },
        };
      }
    }

    // Update account with conditional check for sufficient balance
    const account = await tx.account.update({
      where: { id: accountId },
      data: updateData,
    });

    // Verify balance didn't go negative
    if (account.available.lessThan(0)) {
      throw new AppError('Insufficient available balance', 400);
    }

    return account;
  }

  /**
   * Get account statement
   */
  async getAccountStatement(
    accountId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      type?: LedgerEntryType;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ entries: LedgerEntry[]; total: number; balances: any }> {
    const where: Prisma.LedgerEntryWhereInput = {
      accountId,
      ...(filters.startDate || filters.endDate) && {
        createdAt: {
          ...(filters.startDate && { gte: filters.startDate }),
          ...(filters.endDate && { lte: filters.endDate }),
        },
      },
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
    };

    const [entries, total, account] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.account.findUnique({
        where: { id: accountId },
      }),
    ]);

    return {
      entries,
      total,
      balances: {
        balance: account?.balance || 0,
        available: account?.available || 0,
        pending: account?.pending || 0,
        currency: account?.currency,
      },
    };
  }

  /**
   * Settle a ledger entry (mark as settled)
   */
  async settleLedgerEntry(
    ledgerEntryId: string,
    metadata?: any
  ): Promise<LedgerEntry> {
    return this.prisma.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        metadata: metadata
          ? { ...metadata, settledAt: new Date().toISOString() }
          : { settledAt: new Date().toISOString() },
      },
    });
  }

  /**
   * Reverse a ledger entry
   */
  async reverseLedgerEntry(
    ledgerEntryId: string,
    reason: string
  ): Promise<{ original: LedgerEntry; reversal: LedgerEntry }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Get original entry
      const original = await tx.ledgerEntry.findUnique({
        where: { id: ledgerEntryId },
        include: { account: true },
      });

      if (!original) {
        throw new AppError('Ledger entry not found', 404);
      }

      if (original.status === 'REVERSED') {
        throw new AppError('Entry already reversed', 400);
      }

      // 2. Create reversal entry
      const reversal = await this.createLedgerEntry(tx as any, {
        accountId: original.accountId,
        type: 'REVERSAL',
        amount: original.amount.toNumber(),
        currency: original.currency,
        direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
        referenceId: original.id,
        metadata: {
          reversalOf: original.id,
          reason,
          originalType: original.type,
          originalDirection: original.direction,
        },
        description: `Reversal: ${reason}`,
      });

      // 3. Mark original as reversed
      await tx.ledgerEntry.update({
        where: { id: original.id },
        data: {
          status: 'REVERSED',
          metadata: {
            ...(original.metadata as any),
            reversedAt: new Date().toISOString(),
            reversalId: reversal.id,
            reversalReason: reason,
          },
        },
      });

      return { original, reversal };
    });
  }

  /**
   * Reconcile accounts with external systems
   */
  async reconcileAccounts(date: Date): Promise<any> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Get all settled ledger entries for the day
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        status: 'SETTLED',
        settledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        referenceId: { not: null },
      },
      include: {
        account: true,
      },
    });

    // Group by account and currency
    const reconciliationReport: any = {
      date: startOfDay.toISOString(),
      accounts: {},
      discrepancies: [],
      summary: {
        totalEntries: ledgerEntries.length,
        totalAmount: 0,
        totalAccounts: 0,
      },
    };

    for (const entry of ledgerEntries) {
      const key = `${entry.accountId}-${entry.currency}`;

      if (!reconciliationReport.accounts[key]) {
        reconciliationReport.accounts[key] = {
          accountId: entry.accountId,
          currency: entry.currency,
          entries: [],
          creditTotal: 0,
          debitTotal: 0,
          netChange: 0,
        };
      }

      const accountReport = reconciliationReport.accounts[key];
      accountReport.entries.push({
        id: entry.id,
        type: entry.type,
        amount: entry.amount.toNumber(),
        direction: entry.direction,
        referenceId: entry.referenceId,
        settledAt: entry.settledAt,
      });

      if (entry.direction === 'CREDIT') {
        accountReport.creditTotal += entry.amount.toNumber();
      } else {
        accountReport.debitTotal += entry.amount.toNumber();
      }

      accountReport.netChange = accountReport.creditTotal - accountReport.debitTotal;
      reconciliationReport.summary.totalAmount += entry.amount.toNumber();
    }

    reconciliationReport.summary.totalAccounts = Object.keys(
      reconciliationReport.accounts
    ).length;

    // Log reconciliation
    logger.info('Account reconciliation completed', {
      date: startOfDay.toISOString(),
      summary: reconciliationReport.summary,
    });

    return reconciliationReport;
  }

  /**
   * Get account balances for user
   */
  async getUserBalances(userId: string): Promise<any[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { currency: 'asc' }],
    });

    return accounts.map((account) => ({
      id: account.id,
      type: account.type,
      currency: account.currency,
      balance: account.balance.toNumber(),
      available: account.available.toNumber(),
      pending: account.pending.toNumber(),
      frozen: account.frozen,
      provider: account.provider,
      updatedAt: account.updatedAt,
    }));
  }

  /**
   * Create batch ledger entries (for bulk operations)
   */
  async createBatchLedgerEntries(
    entries: CreateLedgerEntryParams[]
  ): Promise<LedgerEntry[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const createdEntries: LedgerEntry[] = [];

        for (const entry of entries) {
          const created = await this.createLedgerEntry(tx as any, entry);
          createdEntries.push(created);
        }

        return createdEntries;
      },
      {
        maxWait: 10000, // 10 seconds
        timeout: 30000, // 30 seconds
      }
    );
  }
}
