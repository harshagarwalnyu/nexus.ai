import { query } from "./dataService.js";

const CATALOG = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "raw_data";
const TABLE = `${CATALOG}.${SCHEMA}.audit_log`;

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      event_id      STRING,
      event_type    STRING,
      account_id    STRING,
      job_id        STRING,
      tool_name     STRING,
      status        STRING,
      details       STRING,
      created_at    TIMESTAMP
    )
    USING DELTA
  `);
  tableReady = true;
}

function escSql(val) {
  if (val === null || val === undefined) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

export async function auditLog(eventType, payload = {}) {

  (async () => {
    try {
      await ensureTable();

      const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const details = payload.details
        ? escSql(typeof payload.details === "object" ? JSON.stringify(payload.details) : payload.details)
        : "NULL";

      await query(`
        INSERT INTO ${TABLE}
          (event_id, event_type, account_id, job_id, tool_name, status, details, created_at)
        VALUES (
          ${escSql(eventId)},
          ${escSql(eventType)},
          ${escSql(payload.account_id ?? null)},
          ${escSql(payload.job_id ?? null)},
          ${escSql(payload.tool_name ?? null)},
          ${escSql(payload.status ?? "ok")},
          ${details},
          CURRENT_TIMESTAMP()
        )
      `);
    } catch (err) {

      console.error(`[audit] Failed to log event "${eventType}":`, err.message);
    }
  })();
}

export async function getAuditLog(limit = 50, accountId = null) {
  try {
    await ensureTable();
    const whereClause = accountId ? `WHERE account_id = ${escSql(accountId)}` : "";
    return await query(
      `SELECT * FROM ${TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ${limit}`
    );
  } catch (err) {
    console.error("[audit] Failed to fetch audit log:", err.message);
    return [];
  }
}