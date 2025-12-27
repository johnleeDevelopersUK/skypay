// skypay-backend/src/api/routes/webhook.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { body, header, validationResult } from 'express-validator';
import crypto from 'crypto';
import { WebhookProcessor } from '../../webhooks/WebhookProcessor';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { WebhookEvent } from '../../types/webhooks';

const router = Router();
const webhookProcessor = new WebhookProcessor();

// Webhook signature verification functions
const verifyBridgeSignature = (signature: string, timestamp: string, payload: any): boolean => {
  const secret = process.env.BRIDGE_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('BRIDGE_WEBHOOK_SECRET not configured');
    return false;
  }

  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

const verifyPaystackSignature = (req: Request): boolean => {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('PAYSTACK_WEBHOOK_SECRET not configured');
    return false;
  }

  const signature = req.headers['x-paystack-signature'] as string;
  if (!signature) {
    return false;
  }

  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return hash === signature;
};

const verifyStripeSignature = (req: Request): boolean => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('STRIPE_WEBHOOK_SECRET not configured');
    return false;
  }

  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    return false;
  }

  try {
    const crypto = require('crypto');
    const timestamp = req.headers['stripe-timestamp'] as string;
    const signedPayload = `${timestamp}.${JSON.stringify(req.body)}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Stripe signature verification failed:', error);
    return false;
  }
};

// Middleware to validate webhook secret
const validateWebhookSecret = (secretEnvVar: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const expectedSecret = process.env[secretEnvVar];
    const providedSecret = req.headers['x-webhook-secret'];

    if (!expectedSecret || expectedSecret !== providedSecret) {
      throw new AppError('Invalid webhook secret', 401);
    }
    next();
  };
};

// Middleware to validate webhook signature
const validateSignature = (provider: 'bridge' | 'paystack' | 'stripe') => {
  return (req: Request, res: Response, next: NextFunction) => {
    let isValid = false;

    switch (provider) {
      case 'bridge':
        const bridgeSignature = req.headers['x-bridge-signature'] as string;
        const bridgeTimestamp = req.headers['x-bridge-timestamp'] as string;
        if (bridgeSignature && bridgeTimestamp) {
          isValid = verifyBridgeSignature(bridgeSignature, bridgeTimestamp, req.body);
        }
        break;
      case 'paystack':
        isValid = verifyPaystackSignature(req);
        break;
      case 'stripe':
        isValid = verifyStripeSignature(req);
        break;
    }

    if (!isValid) {
      throw new AppError(`Invalid ${provider} webhook signature`, 401);
    }
    next();
  };
};

// Generic webhook handler
const handleWebhook = async (
  provider: string,
  eventType: string,
  payload: any,
  res: Response
) => {
  try {
    logger.info(`Processing ${provider} webhook: ${eventType}`, { payload });

    // Process webhook asynchronously to avoid timeout
    webhookProcessor.process(`${provider}.${eventType}`, payload)
      .then(success => {
        if (!success) {
          logger.error(`Failed to process ${provider} webhook: ${eventType}`);
        }
      })
      .catch(error => {
        logger.error(`Error processing ${provider} webhook:`, error);
      });

    // Acknowledge receipt immediately
    res.json({ 
      success: true, 
      message: 'Webhook received and processing' 
    });

  } catch (error) {
    logger.error(`${provider} webhook handling error:`, error);
    throw error;
  }
};

/**
 * Bridge webhook endpoint
 */
router.post(
  '/bridge',
  [
    header('x-bridge-signature').isString(),
    header('x-bridge-timestamp').isInt({ min: 0 }),
    body().isObject(),
    validateSignature('bridge')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, { errors: errors.array() });
      }

      const payload = req.body;
      const eventType = payload.event || payload.type;

      if (!eventType) {
        throw new AppError('Missing event type in payload', 400);
      }

      await handleWebhook('bridge', eventType, payload, res);

    } catch (error) {
      logger.error('Bridge webhook error:', error);
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          ...(error.details && { details: error.details })
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * Blockchain webhook endpoint
 */
router.post(
  '/blockchain',
  [
    header('x-webhook-secret').notEmpty(),
    body().isObject(),
    validateWebhookSecret('BLOCKCHAIN_WEBHOOK_SECRET')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, { errors: errors.array() });
      }

      const payload = req.body;
      const eventType = payload.event || payload.type;

      if (!eventType) {
        throw new AppError('Missing event type in payload', 400);
      }

      await handleWebhook('blockchain', eventType, payload, res);

    } catch (error) {
      logger.error('Blockchain webhook error:', error);
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
);

/**
 * Partner webhooks (Paystack, Stripe, MTN, Airtel)
 */
const createPartnerWebhookRoute = (partner: string) => {
  const validations: any[] = [body().isObject()];

  // Add signature validation for providers that require it
  if (partner === 'paystack' || partner === 'stripe') {
    validations.push(validateSignature(partner as 'paystack' | 'stripe'));
  }

  validations.push(async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, { errors: errors.array() });
      }

      const payload = req.body;
      const eventType = payload.event || payload.type || payload.Event;

      if (!eventType) {
        throw new AppError('Missing event type in payload', 400);
      }

      await handleWebhook(partner, eventType, payload, res);

    } catch (error) {
      logger.error(`${partner} webhook error:`, error);
      
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          ...(error.details && { details: error.details })
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  });

  return validations;
};

// Register partner webhooks
router.post('/paystack', ...createPartnerWebhookRoute('paystack'));
router.post('/stripe', ...createPartnerWebhookRoute('stripe'));
router.post('/mtn', ...createPartnerWebhookRoute('mtn'));
router.post('/airtel', ...createPartnerWebhookRoute('airtel'));

// Health check for webhooks
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/webhooks/bridge',
      '/webhooks/blockchain',
      '/webhooks/paystack',
      '/webhooks/stripe',
      '/webhooks/mtn',
      '/webhooks/airtel'
    ]
  });
});

export default router;
