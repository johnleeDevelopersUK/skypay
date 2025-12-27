import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { Transaction } from './Transaction'
import { Wallet } from './Wallet'
import { AuditLog } from './AuditLog'
import { KYCVerification } from './KYCVerification'
import bcrypt from 'bcryptjs'

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
  PENDING = 'pending',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  COMPLIANCE = 'compliance',
  SUPPORT = 'support',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  @Index()
  email: string

  @Column({ nullable: true })
  phone?: string

  @Column()
  firstName: string

  @Column()
  lastName: string

  @Column({ select: false })
  passwordHash: string

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus

  @Column({ default: false })
  isEmailVerified: boolean

  @Column({ default: false })
  isPhoneVerified: boolean

  @Column({ default: false })
  is2FAEnabled: boolean

  @Column({ nullable: true })
  twoFASecret?: string

  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    language: string
    currency: string
    notifications: {
      email: boolean
      sms: boolean
      push: boolean
    }
    security: {
      loginAlerts: boolean
      transactionAlerts: boolean
    }
  }

  @Column({ type: 'jsonb', nullable: true })
  limits?: {
    dailyDeposit: number
    dailyWithdrawal: number
    monthlyDeposit: number
    monthlyWithdrawal: number
    maxTransaction: number
  }

  @Column({ type: 'jsonb', nullable: true })
  riskScore?: {
    score: number
    level: 'low' | 'medium' | 'high' | 'critical'
    factors: string[]
    lastUpdated: Date
  }

  @Column({ nullable: true })
  lastLoginAt?: Date

  @Column({ nullable: true })
  lastLoginIp?: string

  @Column({ nullable: true })
  lastActivityAt?: Date

  @Column({ type: 'jsonb', nullable: true })
  deviceFingerprint?: Record<string, any>

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[]

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[]

  @OneToMany(() => KYCVerification, (kyc) => kyc.user)
  kycVerifications: KYCVerification[]

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.passwordHash && !this.passwordHash.startsWith('$2a$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash)
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  get isVerified(): boolean {
    return this.isEmailVerified && this.isPhoneVerified
  }

  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE
  }

  get isComplianceBlocked(): boolean {
    return this.status === UserStatus.BLOCKED || this.status === UserStatus.SUSPENDED
  }

  updateRiskScore(score: number, factors: string[]): void {
    const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'
    
    this.riskScore = {
      score,
      level,
      factors,
      lastUpdated: new Date(),
    }
  }

  toJSON(): Partial<User> {
    const user = { ...this }
    delete user.passwordHash
    delete user.twoFASecret
    delete user.deviceFingerprint
    return user
  }
}
