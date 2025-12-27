// skypay-backend/src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  VERSION: z.string().default('1.0.0'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.string().transform((val) => val === 'true').default('false'),
  
  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(32),
  ENCRYPTION_IV: z.string().length(16),
  
  // Blockchain
  POLYGON_RPC_URL: z.string().url(),
  POLYGON_PRIVATE_KEY: z.string().optional(),
  CONTRACT_ADDRESS_VAULT: z.string().optional(),
  CONTRACT_ADDRESS_STABLECOIN: z.string().optional(),
  
  // Bridge Integration
  BRIDGE_API_KEY: z.string(),
  BRIDGE_API_SECRET: z.string(),
  BRIDGE_BASE_URL: z.string().url(),
  BRIDGE_WEBHOOK_SECRET: z.string(),
  
  // Other Integrations
  PAYSTACK_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  MTN_API_KEY: z.string().optional(),
  AIRTEL_API_KEY: z.string().optional(),
  
  // Compliance Providers
  CHAINALYSIS_API_KEY: z.string().optional(),
  ELLIPSIS_API_KEY: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  version: env.VERSION,
  
  database: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },
  
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  encryption: {
    key: env.ENCRYPTION_KEY,
    iv: env.ENCRYPTION_IV,
  },
  
  blockchain: {
    polygonRpcUrl: env.POLYGON_RPC_URL,
    polygonPrivateKey: env.POLYGON_PRIVATE_KEY,
    contractAddresses: {
      vault: env.CONTRACT_ADDRESS_VAULT,
      stablecoin: env.CONTRACT_ADDRESS_STABLECOIN,
    },
  },
  
  integrations: {
    bridge: {
      apiKey: env.BRIDGE_API_KEY,
      apiSecret: env.BRIDGE_API_SECRET,
      baseUrl: env.BRIDGE_BASE_URL,
      webhookSecret: env.BRIDGE_WEBHOOK_SECRET,
    },
    paystack: {
      secretKey: env.PAYSTACK_SECRET_KEY,
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
    },
    mtn: {
      apiKey: env.MTN_API_KEY,
    },
    airtel: {
      apiKey: env.AIRTEL_API_KEY,
    },
  },
  
  compliance: {
    chainalysis: env.CHAINALYSIS_API_KEY,
    ellipsis: env.ELLIPSIS_API_KEY,
    sumsub: env.SUMSUB_SECRET_KEY,
  },
  
  corsOrigins: env.CORS_ORIGINS.split(','),
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX,
  },
};

// Type exports
export type Config = typeof config;
export type BlockchainConfig = typeof config.blockchain;
export type BridgeConfig = typeof config.integrations.bridge;
