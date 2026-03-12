import { query } from "./dataService.js";
import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const CATALOG = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "raw_data";

export const DATA_CLASSIFICATION = {
  accounts: {
    account_id: "CONFIDENTIAL",
    account_name: "PUBLIC",
    industry: "PUBLIC",
    annual_contract_value: "FINANCIAL",
    contract_renewal_date: "CONFIDENTIAL",
    assigned_rep: "CONFIDENTIAL",
    region: "PUBLIC",
    days_since_last_contact: "CONFIDENTIAL",
    health_archetype: "CONFIDENTIAL",
    account_tier: "CONFIDENTIAL",
    hq_lat: "PUBLIC",
    hq_lng: "PUBLIC",
    created_at: "CONFIDENTIAL",
  },
  contacts: {
    contact_id: "PII",
    account_id: "CONFIDENTIAL",
    name: "PII",
    email: "PII",
    phone: "PII",
    role: "CONFIDENTIAL",
    department: "CONFIDENTIAL",
  },
  support_tickets: {
    ticket_id: "CONFIDENTIAL",
    account_id: "CONFIDENTIAL",
    subject: "CONFIDENTIAL",
    status: "PUBLIC",
    priority: "PUBLIC",
    created_at: "PUBLIC",
  },
};

const PII_PATTERNS = [
  { name: "email", pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL REDACTED]" },
  { name: "phone", pattern: /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, replacement: "[PHONE REDACTED]" },
  { name: "ssn", pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: "[SSN REDACTED]" },
  { name: "acct", pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: "[ACCOUNT# REDACTED]" },
  { name: "internal_account", pattern: /\bACC-[A-Z0-9]{4,}\b/gi, replacement: "[INTERNAL_ACCOUNT_ID REDACTED]" },
  { name: "address", pattern: /\b\d{1,5}\s(?:[A-Za-z0-9#\.]+\s?){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/gi, replacement: "[ADDRESS REDACTED]" },
];

export function redactPII(text) {
  if (!text || typeof text !== "string") return { redacted: text, piiFound: false, redactedTypes: [] };

  let redacted = text;
  const foundTypes = [];

  for (const { name, pattern, replacement } of PII_PATTERNS) {
    if (pattern.test(redacted)) {
      foundTypes.push(name);
      redacted = redacted.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }

  return {
    redacted,
    piiFound: foundTypes.length > 0,
    redactedTypes: foundTypes,
  };
}

export function sanitizeAccountForExternalAI(account) {
  const acv = Number(account.annual_contract_value) || 0;
  const acvTier = acv >= 5_000_000 ? "Enterprise ($5M+)" :
    acv >= 1_000_000 ? "Mid-Market ($1M-5M)" :
      acv >= 100_000 ? "Commercial ($100K-1M)" :
        "SMB (under $100K)";

  return {
    account_name: account.account_name,
    industry: account.industry,
    region: account.region,
    acv_tier: acvTier,
    health_archetype: account.health_archetype,
    days_since_last_contact: account.days_since_last_contact,

  };
}

export function sanitizeContactsForExternalAI(contacts) {
  const roleCounts = {};
  for (const c of contacts) {
    const role = c.role || "Unknown";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  return Object.entries(roleCounts)
    .map(([role, count]) => `${role}: ${count}`)
    .join(", ");
}

const AUDIT_TABLE = `${CATALOG}.security.ai_query_log`;
let auditTableInitialized = false;

export async function logAIQuery(event) {
  const {
    query_type,
    model,
    account_ids,
    data_fields_accessed,
    input_summary,
    output_summary,
    pii_redacted,
    confidence_score,
    ip_address,
    session_id,
  } = event;

  const inputHash = input_summary ? crypto.createHash("sha256").update(input_summary).digest("hex").slice(0, 16) : null;
  const outputHash = output_summary ? crypto.createHash("sha256").update(output_summary).digest("hex").slice(0, 16) : null;

  const logEntry = {
    log_id: crypto.randomUUID(),
    query_type: query_type || "unknown",
    model: model || "unknown",
    account_ids_accessed: JSON.stringify(account_ids || []),
    data_fields_accessed: JSON.stringify(data_fields_accessed || []),
    pii_was_redacted: pii_redacted ?? false,
    confidence_score: confidence_score ?? null,
    input_hash: inputHash,
    output_hash: outputHash,
    session_id: session_id || null,
    ip_address: ip_address || null,
    created_at: new Date().toISOString(),
  };

  initAuditTable()
    .then(() => query(`
      INSERT INTO ${AUDIT_TABLE} (
        log_id, query_type, model, account_ids_accessed,
        data_fields_accessed, pii_was_redacted, confidence_score,
        input_hash, output_hash, session_id, ip_address, created_at
      ) VALUES (
        '${logEntry.log_id}',
        '${logEntry.query_type}',
        '${logEntry.model}',
        '${logEntry.account_ids_accessed.replace(/'/g, "''")}',
        '${logEntry.data_fields_accessed.replace(/'/g, "''")}',
        ${logEntry.pii_was_redacted ? "TRUE" : "FALSE"},
        ${logEntry.confidence_score !== null ? logEntry.confidence_score : "NULL"},
        ${logEntry.input_hash ? `'${logEntry.input_hash}'` : "NULL"},
        ${logEntry.output_hash ? `'${logEntry.output_hash}'` : "NULL"},
        ${logEntry.session_id ? `'${logEntry.session_id}'` : "NULL"},
        ${logEntry.ip_address ? `'${logEntry.ip_address}'` : "NULL"},
        '${logEntry.created_at}'
      )
    `))
    .catch((err) => {
      console.warn("[governance] AI audit log write failed:", err.message);
    });
}

async function initAuditTable() {
  if (auditTableInitialized) return;
  try {
    await query(`CREATE SCHEMA IF NOT EXISTS ${CATALOG}.security`);
    await query(`
      CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
        log_id               STRING       NOT NULL,
        query_type           STRING,
        model                STRING,
        account_ids_accessed STRING,
        data_fields_accessed STRING,
        pii_was_redacted     BOOLEAN,
        confidence_score     DOUBLE,
        input_hash           STRING,
        output_hash          STRING,
        session_id           STRING,
        ip_address           STRING,
        created_at           TIMESTAMP
      )
      USING DELTA
      TBLPROPERTIES (
        'delta.enableChangeDataFeed' = 'true',
        'comment' = 'AI query audit log for compliance tracking'
      )
    `);
    auditTableInitialized = true;
    console.log("[governance] ✅ AI audit table initialized:", AUDIT_TABLE);
  } catch (err) {
    console.warn("[governance] Could not init audit table:", err.message);
  }
}

let rateLimiters = {};

function getRateLimiter(path) {
    if (rateLimiters[path]) return rateLimiters[path];

    const config = RATE_LIMITS[path];
    if (!config) return null;

    const useRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

    if (useRedis) {
        console.log(`[governance] Initializing global rate limiter for ${path} using Redis`);
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        rateLimiters[path] = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(config.limit, `${config.windowMs}ms`),
            prefix: `nexus:ratelimit:${path}`,
        });
    } else {
        if (process.env.NODE_ENV === "production") {
            console.error(`[governance] CRITICAL: Redis not configured for rate limiting in production. Falling back to local in-memory limiting (INEFFECTIVE for multi-instance deployments).`);
        } else {
            console.warn(`[governance] Using local in-memory rate limiter for ${path}. (Redis not configured)`);
        }

        rateLimiters[path] = {
            limit: async (key) => {
                const now = Date.now();
                const storeKey = `${path}:${key}`;
                let state = inMemoryStore.get(storeKey);
                if (!state || now - state.windowStart > config.windowMs) {
                    state = { count: 0, windowStart: now };
                }
                state.count++;
                inMemoryStore.set(storeKey, state);
                return {
                    success: state.count <= config.limit,
                    remaining: Math.max(0, config.limit - state.count),
                    reset: state.windowStart + config.windowMs,
                };
            },
        };
    }

    return rateLimiters[path];
}

const inMemoryStore = new Map();

async function checkRateLimit(key, limit = 10, windowMs = 60_000, path = "") {
    const limiter = getRateLimiter(path);
    if (!limiter) return { allowed: true, remaining: limit, resetIn: 0 };

    const result = await limiter.limit(key);
    return {
        allowed: result.success,
        remaining: result.remaining,
        resetIn: Math.max(0, result.reset - Date.now()),
    };
}

export const RATE_LIMITS = {
  "/api/v1/orchestrated-research": { limit: 5, windowMs: 60_000 },
  "/api/v1/risk-signals": { limit: 10, windowMs: 60_000 },
  "/api/v1/market-events": { limit: 10, windowMs: 60_000 },
  "/api/v1/portfolio-signals": { limit: 20, windowMs: 60_000 },
  "/api/v1/sentiment-history": { limit: 20, windowMs: 60_000 },
  "/api/portfolio-summary": { limit: 10, windowMs: 60_000 },
  "/api/research-account": { limit: 5, windowMs: 60_000 },
  "/api/chat": { limit: 30, windowMs: 60_000 },
};

export async function governanceMiddleware(req, res, next) {

  const matchedPath = Object.keys(RATE_LIMITS).find((p) => req.path.startsWith(p));

  if (matchedPath) {
    const { limit, windowMs } = RATE_LIMITS[matchedPath];
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const key = `${ip}:${matchedPath}`;
    const result = await checkRateLimit(key, limit, windowMs, matchedPath);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetIn / 1000));

    if (!result.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        retry_after_seconds: Math.ceil(result.resetIn / 1000),
      });
    }
  }

  req.governanceSession = {
    ip: req.ip || req.connection?.remoteAddress || "unknown",
    session_id: req.headers["x-session-id"] || null,
  };

  next();
}

export function validateResearchTaskSafety(task) {
  const issues = [];

  const { piiFound, redactedTypes } = redactPII(task.query || "");
  if (piiFound) {
    issues.push(`Query contains potential PII (${redactedTypes.join(", ")}) — will be redacted`);
  }

  const INTERNAL_PATTERNS = [
    { pattern: /ACC-\d+/i, label: "internal account ID" },
    { pattern: /\$[\d,]+\.\d{2}/g, label: "exact financial amounts" },
  ];

  for (const { pattern, label } of INTERNAL_PATTERNS) {
    if (pattern.test(task.query || "")) {
      issues.push(`Query contains ${label} — consider using generalized values`);
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

export async function applyUnityCatalogTags() {
  const results = [];

  for (const [tableName, columns] of Object.entries(DATA_CLASSIFICATION)) {
    for (const [column, classification] of Object.entries(columns)) {
      if (classification === "PII") {
        try {

          await query(`
            ALTER TABLE ${CATALOG}.${SCHEMA}.${tableName}
            ALTER COLUMN ${column}
            COMMENT 'PII:${classification} — requires masking before external AI use'
          `);
          results.push({ table: tableName, column, classification, status: "tagged" });
        } catch (err) {
          results.push({ table: tableName, column, classification, status: "failed", error: err.message });
        }
      }
    }
  }

  return results;
}

export async function getColumnMetadata(tableName) {
  try {
    const rows = await query(`
      SELECT column_name, data_type, comment
      FROM ${CATALOG}.information_schema.columns
      WHERE table_schema = '${SCHEMA}'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    return rows.map((r) => ({
      column: r.column_name,
      type: r.data_type,
      classification: r.comment?.startsWith("PII:") ? r.comment.split(" ")[0].replace("PII:", "") : DATA_CLASSIFICATION[tableName]?.[r.column_name] || "UNCLASSIFIED",
      has_pii_tag: r.comment?.includes("PII:"),
    }));
  } catch {

    return Object.entries(DATA_CLASSIFICATION[tableName] || {}).map(([col, cls]) => ({
      column: col,
      type: "STRING",
      classification: cls,
      has_pii_tag: cls === "PII",
    }));
  }
}

export async function getAIQueryAuditReport(days = 30) {
  try {
    const rows = await query(`
      SELECT
        query_type,
        model,
        COUNT(*) as query_count,
        SUM(CASE WHEN pii_was_redacted THEN 1 ELSE 0 END) as pii_redacted_count,
        AVG(confidence_score) as avg_confidence,
        MIN(created_at) as first_query,
        MAX(created_at) as last_query
      FROM ${AUDIT_TABLE}
      WHERE created_at >= DATEADD(DAY, -${days}, CURRENT_TIMESTAMP())
      GROUP BY query_type, model
      ORDER BY query_count DESC
    `);

    return {
      period_days: days,
      generated_at: new Date().toISOString(),
      summary: rows,
    };
  } catch (err) {
    return {
      period_days: days,
      generated_at: new Date().toISOString(),
      error: `Audit table not yet available: ${err.message}`,
      summary: [],
    };
  }
}