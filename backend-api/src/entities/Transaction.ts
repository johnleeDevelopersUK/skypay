import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  BeforeInsert,
} from 'typeorm'
import { User } from './User'
import { Wallet } from './Wallet'

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  SWAP = 'swap',
  BRIDGE = 'bridge',
  CONVERSION = 'conversion',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVERSED = 'reversed',
  ON_HOLD = 'on_hold',
}

export enum TransactionSource {
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
  CRYPTO = 'crypto',
  MOBILE_MONEY = 'mobile_money',
  INTERNAL = 'internal',
}

@Entity('transactions')
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['reference', 'externalReference'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  userId: string

  @ManyToOne(() => User, (user) => user.transactions)
  user: User

  @Column({ nullable: true })
  walletId?: string

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  wallet?: Wallet

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus

  @Column({
    type: 'enum',
    enum: TransactionSource,
  })
  source: TransactionSource

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  fee: number

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  netAmount: number

  @Column()
  currency: string

  @Column({ nullable: true })
  toCurrency?: string

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  exchangeRate?: number

  @Column({ nullable: true })
  senderWalletAddress?: string

  @Column({ nullable: true })
  recipientWalletAddress?: string

  @Column({ nullable: true })
  bankName?: string

  @Column({ nullable: true })
  bankAccountNumber?: string

  @Column({ nullable: true })
  bankAccountName?: string

  @Column({ nullable: true })
  bankRoutingNumber?: string

  @Column({ nullable: true })
  bankSwiftCode?: string

  @Column({ unique: true })
  reference: string

  @Column({ nullable: true, unique: true })
  externalReference?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    ipAddress?: string
    userAgent?: string
    deviceId?: string
    location?: {
      country: string
      city: string
      ip: string
    }
    complianceCheck?: {
      amlScore?: number
      sanctionCheck?: boolean
      riskLevel?: string
    }
    blockchain?: {
      txHash?: string
      blockNumber?: number
      gasUsed?: number
      gasPrice?: number
    }
    providerData?: Record<string, any>
  }

  @Column({ type: 'jsonb', nullable: true })
  complianceFlags?: {
    isSuspicious: boolean
    riskScore: number
    riskFactors: string[]
    requiresReview: boolean
    reviewedBy?: string
    reviewedAt?: Date
    reviewNotes?: string
  }

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ nullable: true })
  completedAt?: Date

  @Column({ nullable: true })
  failedAt?: Date

  @Column({ type: 'text', nullable: true })
  failureReason?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  generateReference(): void {
    if (!this.reference) {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 10).toUpperCase()
      this.reference = `TX${timestamp}${random}`
    }
  }

  @BeforeInsert()
  calculateNetAmount(): void {
    this.netAmount = this.amount - this.fee
  }

  markAsCompleted(): void {
    this.status = TransactionStatus.COMPLETED
    this.completedAt = new Date()
  }

  markAsFailed(reason: string): void {
    this.status = TransactionStatus.FAILED
    this.failedAt = new Date()
    this.failureReason = reason
  }

  isSuspicious(): boolean {
    return this.complianceFlags?.isSuspicious || false
  }

  requiresReview(): boolean {
    return this.complianceFlags?.requiresReview || false
  }

  get totalAmount(): number {
    return this.amount + this.fee
  }

  toJSON(): Partial<Transaction> {
    const transaction = { ...this }
    // Remove sensitive data
    delete transaction.metadata?.providerData
    return transaction
  }
}
