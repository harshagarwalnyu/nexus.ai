import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().min(1, 'PORT must be specified').default('3001'),
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET must be specified'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY must be specified'),

  // Slack integration (optional — alerts and notifications disabled if absent)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_P0_CHANNEL: z.string().optional(),
  SLACK_P1_CHANNEL: z.string().optional(),
  SLACK_P2_CHANNEL: z.string().optional(),
  SLACK_P3_CHANNEL: z.string().optional(),
  SLACK_AUTO_ALERT: z.enum(['true', 'false']).optional(),

  // Gmail integration (optional — email send disabled if absent)
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_FROM_ADDRESS: z.string().email().optional(),

  // Databricks integration (optional — falls back to local DuckDB if absent)
  DATABRICKS_HOST: z.string().url().optional(),
  DATABRICKS_TOKEN: z.string().optional(),
  DATABRICKS_HTTP_PATH: z.string().optional(),
  DATABRICKS_CATALOG: z.string().optional(),
  DATABRICKS_SCHEMA: z.string().optional(),

  // NIA research integration (optional — web search / oracle disabled if absent)
  NIA_API_KEY: z.string().optional(),
  NIA_BASE_URL: z.string().url().optional(),
}).passthrough();

const integrationWarnings = [
  {
    vars: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    label: 'Slack',
    detail: 'alerts and notifications will be disabled',
  },
  {
    vars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
    label: 'Gmail',
    detail: 'email send will fail',
  },
  {
    vars: ['DATABRICKS_HOST', 'DATABRICKS_TOKEN'],
    label: 'Databricks',
    detail: 'falling back to local DuckDB',
  },
  {
    vars: ['NIA_API_KEY'],
    label: 'NIA',
    detail: 'web search and oracle research will be disabled',
  },
];

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Environment variable validation failed. See logs for details.');
  }

  for (const { vars, label, detail } of integrationWarnings) {
    const missing = vars.filter(v => !parsed.data[v]);
    if (missing.length > 0) {
      console.warn(`⚠️  ${label} not fully configured (missing: ${missing.join(', ')}) — ${detail}`);
    }
  }

  return parsed.data;
}