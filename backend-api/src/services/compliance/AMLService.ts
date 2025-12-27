import axios from 'axios'
import { Transaction } from '../../entities/Transaction'
import { User } from '../../entities/User'
import { logger } from '../../config/logger'
import { RiskEngine } from './RiskEngine'
import { CacheService } from '../CacheService'

export class AMLService {
  private riskEngine: RiskEngine
  private cache: CacheService

  constructor() {
    this.riskEngine = new RiskEngine()
    this.cache = new CacheService()
  }

  async screenTransaction(transaction: Transaction, user: User): Promise<{
    riskScore: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    flags: string[]
    requiresReview: boolean
  }> {
    try {
      // Check cache first
      const cacheKey = `aml:transaction:${transaction.reference}`
      const cachedResult = await this.cache.get(cacheKey)
      if (cachedResult) {
        return JSON.parse(cachedResult)
      }

      const checks = await Promise.allSettled([
        this.checkSanctions(user, transaction),
        this.checkPEP(user),
        this.checkAdverseMedia(user),
        this.checkTransactionPatterns(transaction, user),
        this.checkGeographicRisk(transaction),
        this.checkAmountRisk(transaction),
        this.checkVelocity(transaction, user),
      ])

      const flags: string[] = []
      const riskFactors: string[] = []

      checks.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          flags.push(result.value.flag)
          riskFactors.push(result.value.riskFactor)
        }
      })

      // Calculate risk score
      const riskScore = this.calculateRiskScore(flags, riskFactors)
      const riskLevel = this.getRiskLevel(riskScore)
      const requiresReview = riskScore >= 60 || flags.length > 2

      const result = {
        riskScore,
        riskLevel,
        flags,
        requiresReview,
      }

      // Cache result for 24 hours
      await this.cache.set(cacheKey, JSON.stringify(result), 86400)

      // Log suspicious transactions
      if (riskScore >= 70) {
        logger.warn('Suspicious transaction detected', {
          transactionId: transaction.id,
          userId: user.id,
          riskScore,
          flags,
          amount: transaction.amount,
          currency: transaction.currency,
        })
      }

      return result
    } catch (error) {
      logger.error('AML screening failed', { error, transactionId: transaction.id })
      // Return default low risk on failure
      return {
        riskScore: 10,
        riskLevel: 'low',
        flags: ['SCREENING_FAILED'],
        requiresReview: false,
      }
    }
  }

  private async checkSanctions(user: User, transaction: Transaction): Promise<{ flag: string; riskFactor: string } | null> {
    try {
      // Check with sanctions screening service (ComplyAdvantage, Elliptic, etc.)
      const response = await axios.post(
        `${process.env.COMPLIANCE_API_URL}/sanctions/screen`,
        {
          name: user.fullName,
          country: user.metadata?.country,
          dateOfBirth: user.metadata?.dateOfBirth,
          walletAddress: transaction.recipientWalletAddress,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COMPLIANCE_API_KEY}`,
          },
        }
      )

      if (response.data.matches?.length > 0) {
        return {
          flag: 'SANCTION_MATCH',
          riskFactor: 'sanction',
        }
      }
    } catch (error) {
      logger.error('Sanctions check failed', { error })
    }

    return null
  }

  private async checkPEP(user: User): Promise<{ flag: string; riskFactor: string } | null> {
    try {
      // Check Politically Exposed Person status
      const response = await axios.post(
        `${process.env.COMPLIANCE_API_URL}/pep/check`,
        {
          name: user.fullName,
          country: user.metadata?.country,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COMPLIANCE_API_KEY}`,
          },
        }
      )

      if (response.data.isPEP) {
        return {
          flag: 'PEP_IDENTIFIED',
          riskFactor: 'pep',
        }
      }
    } catch (error) {
      logger.error('PEP check failed', { error })
    }

    return null
  }

  private async checkAdverseMedia(user: User): Promise<{ flag: string; riskFactor: string } | null> {
    try {
      // Check adverse media/news
      const response = await axios.post(
        `${process.env.COMPLIANCE_API_URL}/media/check`,
        {
          name: user.fullName,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.COMPLIANCE_API_KEY}`,
          },
        }
      )

      if (response.data.hasAdverseMedia) {
        return {
          flag: 'ADVERSE_MEDIA',
          riskFactor: 'adverse_media',
        }
      }
    } catch (error) {
      logger.error('Adverse media check failed', { error })
    }

    return null
  }

  private async checkTransactionPatterns(transaction: Transaction, user: User): Promise<{ flag: string; riskFactor: string } | null> {
    const patterns = this.riskEngine.analyzePatterns(transaction, user)
    
    if (patterns.structuring) {
      return {
        flag: 'STRUCTURING_SUSPECTED',
        riskFactor: 'structuring',
      }
    }

    if (patterns.layering) {
      return {
        flag: 'LAYERING_SUSPECTED',
        riskFactor: 'layering',
      }
    }

    if (patterns.roundDollar) {
      return {
        flag: 'ROUND_DOLLAR_AMOUNT',
        riskFactor: 'round_amount',
      }
    }

    return null
  }

  private async checkGeographicRisk(transaction: Transaction): Promise<{ flag: string; riskFactor: string } | null> {
    const highRiskCountries = ['IR', 'KP', 'SY', 'CU', 'SD', 'UA-Crimea']
    const location = transaction.metadata?.location

    if (location && highRiskCountries.includes(location.country)) {
      return {
        flag: 'HIGH_RISK_GEOGRAPHY',
        riskFactor: 'high_risk_country',
      }
    }

    return null
  }

  private async checkAmountRisk(transaction: Transaction): Promise<{ flag: string; riskFactor: string } | null> {
    // Check for amounts just below reporting thresholds
    const thresholds = {
      USD: 10000,
      EUR: 9000,
      GBP: 8000,
    }

    const threshold = thresholds[transaction.currency as keyof typeof thresholds] || 10000

    if (transaction.amount >= threshold * 0.9 && transaction.amount < threshold) {
      return {
        flag: 'THRESHOLD_AVOIDANCE',
        riskFactor: 'threshold_avoidance',
      }
    }

    // Check for unusually large amounts
    if (transaction.amount > threshold * 10) {
      return {
        flag: 'UNUSUALLY_LARGE',
        riskFactor: 'large_amount',
      }
    }

    return null
  }

  private async checkVelocity(transaction: Transaction, user: User): Promise<{ flag: string; riskFactor: string } | null> {
    const velocity = await this.riskEngine.calculateVelocity(user.id, transaction.currency)

    if (velocity.hourly > 10) {
      return {
        flag: 'HIGH_FREQUENCY',
        riskFactor: 'high_frequency',
      }
    }

    if (velocity.daily > 50) {
      return {
        flag: 'EXCESSIVE_DAILY_VOLUME',
        riskFactor: 'high_volume',
      }
    }

    return null
  }

  private calculateRiskScore(flags: string[], riskFactors: string[]): number {
    let score = 10 // Base score

    // Add points based on flags
    const flagWeights: Record<string, number> = {
      'SANCTION_MATCH': 100,
      'PEP_IDENTIFIED': 70,
      'ADVERSE_MEDIA': 60,
      'STRUCTURING_SUSPECTED': 50,
      'LAYERING_SUSPECTED': 50,
      'HIGH_RISK_GEOGRAPHY': 40,
      'THRESHOLD_AVOIDANCE': 30,
      'UNUSUALLY_LARGE': 25,
      'HIGH_FREQUENCY': 20,
      'EXCESSIVE_DAILY_VOLUME': 20,
      'ROUND_DOLLAR_AMOUNT': 15,
    }

    flags.forEach(flag => {
      score += flagWeights[flag] || 10
    })

    // Cap at 100
    return Math.min(score, 100)
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  async generateSAR(transaction: Transaction, user: User, findings: any): Promise<void> {
    // Generate Suspicious Activity Report
    const sar = {
      reportId: `SAR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      transaction: {
        id: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        type: transaction.type,
        date: transaction.createdAt,
      },
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        country: user.metadata?.country,
        riskScore: user.riskScore?.score,
      },
      findings,
      riskScore: findings.riskScore,
      riskLevel: findings.riskLevel,
      reportedBy: 'SYSTEM',
    }

    // Log SAR
    logger.warn('Suspicious Activity Report Generated', sar)

    // Send to compliance team
    await this.notifyComplianceTeam(sar)

    // Store in database
    await this.storeSAR(sar)
  }

  private async notifyComplianceTeam(sar: any): Promise<void> {
    // Implement notification logic
    // This could be email, Slack, internal dashboard notification, etc.
  }

  private async storeSAR(sar: any): Promise<void> {
    // Store SAR in database
  }
}
