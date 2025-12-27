// skypay-backend/src/api/routes/settlement.routes.ts
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { SettlementService } from '../../settlement/SettlementService';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /api/v1/settlements/fiat/deposit:
 *   post:
 *     summary: Initiate fiat deposit
 *     description: Create a fiat to token settlement
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, currency]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *               currency:
 *                 type: string
 *                 enum: [USD, NGN, EUR]
 *               bankDetails:
 *                 type: object
 *                 properties:
 *                   bankCode:
 *                     type: string
 *                   accountNumber:
 *                     type: string
 */
router.post(
  '/fiat/deposit',
  authMiddleware,
  rateLimitMiddleware('fiat_deposit', 10, 3600), // 10 per hour
  [
    body('amount').isFloat({ min: 1 }).toFloat(),
    body('currency').isIn(['USD', 'NGN', 'EUR']),
    body('bankDetails').optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { amount, currency, bankDetails } = req.body;
      const userId = req.user.id;

      const settlement = await req.services.settlement.createSettlement({
        userId,
        type: 'FIAT_TO_TOKEN',
        sourceAmount: amount,
        sourceCurrency: currency,
        targetAmount: amount, // 1:1 for now, would apply fees in production
        targetCurrency: `${currency}X`, // USD -> USST, NGN -> NairaX
        provider: 'BRIDGE',
        metadata: { bankDetails },
      });

      // Get Bridge deposit instructions
      const bridgeInstructions = await req.services.bridge.generateDepositInstructions({
        settlementId: settlement.id,
        amount,
        currency,
        userId,
        bankDetails,
      });

      res.status(201).json({
        success: true,
        data: {
          settlement,
          instructions: bridgeInstructions,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details,
        });
      } else {
        console.error('Fiat deposit error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/settlements/fiat/withdraw:
 *   post:
 *     summary: Initiate fiat withdrawal
 *     description: Create a token to fiat settlement
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/fiat/withdraw',
  authMiddleware,
  rateLimitMiddleware('fiat_withdrawal', 5, 3600), // 5 per hour
  [
    body('amount').isFloat({ min: 1 }).toFloat(),
    body('currency').isIn(['USD', 'NGN', 'EUR']),
    body('bankDetails').isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { amount, currency, bankDetails } = req.body;
      const userId = req.user.id;

      const settlement = await req.services.settlement.createSettlement({
        userId,
        type: 'TOKEN_TO_FIAT',
        sourceAmount: amount,
        sourceCurrency: `${currency}X`,
        targetAmount: amount,
        targetCurrency: currency,
        provider: 'BRIDGE',
        metadata: { bankDetails },
      });

      // Immediately lock tokens
      await req.services.settlement.transitionState(
        settlement.id,
        'TOKEN_LOCKED',
        { amount, currency }
      );

      res.status(201).json({
        success: true,
        data: {
          settlement,
          message: 'Withdrawal initiated. Tokens locked pending processing.',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details,
        });
      } else {
        console.error('Fiat withdrawal error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/settlements/{id}:
 *   get:
 *     summary: Get settlement details
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  authMiddleware,
  [param('id').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { id } = req.params;
      const userId = req.user.id;

      const settlement = await req.services.settlement.getSettlementDetails(id);

      // Verify user owns this settlement
      if (settlement.userId !== userId && !req.user.isAdmin) {
        throw new AppError('Unauthorized', 403);
      }

      res.json({
        success: true,
        data: settlement,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        console.error('Get settlement error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/settlements:
 *   get:
 *     summary: List user settlements
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  authMiddleware,
  [
    query('type').optional().isIn(['FIAT_TO_TOKEN', 'TOKEN_TO_FIAT', 'CROSS_BORDER', 'INTERNAL_TRANSFER']),
    query('status').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const userId = req.user.id;
      const {
        type,
        status,
        limit = 20,
        offset = 0,
        startDate,
        endDate,
      } = req.query;

      const { settlements, total } = await req.services.settlement.getUserSettlements(
        userId,
        {
          type: type as string,
          status: status as string,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        }
      );

      res.json({
        success: true,
        data: {
          settlements,
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: offset + settlements.length < total,
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        console.error('List settlements error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/v1/settlements/{id}/cancel:
 *   post:
 *     summary: Cancel a settlement
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/cancel',
  authMiddleware,
  [param('id').isUUID(), body('reason').optional().isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      // Get settlement to verify ownership
      const settlement = await req.services.settlement.getSettlementDetails(id);
      if (settlement.userId !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      // Check if settlement can be cancelled
      const cancellableStates = ['INITIATED', 'TOKEN_LOCKED'];
      if (!cancellableStates.includes(settlement.currentState)) {
        throw new AppError(
          `Settlement cannot be cancelled in state: ${settlement.currentState}`,
          400
        );
      }

      // Cancel settlement
      await req.services.settlement.transitionState(id, 'FAILED', {
        reason: reason || 'Cancelled by user',
      });

      res.json({
        success: true,
        data: {
          message: 'Settlement cancelled successfully',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        console.error('Cancel settlement error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

export default router;
