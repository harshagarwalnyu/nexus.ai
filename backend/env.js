import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().min(1, 'PORT must be specified').default('3001'),
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET must be specified'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY must be specified'),
}).passthrough();

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Environment variable validation failed. See logs for details.');
  }

  return parsed.data;
}