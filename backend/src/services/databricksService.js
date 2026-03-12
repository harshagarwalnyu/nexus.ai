const HOST = process.env.DATABRICKS_HOST;
const TOKEN = process.env.DATABRICKS_TOKEN;
const HTTP_PATH = process.env.DATABRICKS_HTTP_PATH || "";

const WAREHOUSE_ID = HTTP_PATH.includes("/warehouses/") ? HTTP_PATH.split("/warehouses/")[1] : null;

const CATALOG = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "raw_data";
const CACHE_TABLE = `${CATALOG}.${SCHEMA}.research_cache`;

const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 3_000;

export async function query(sql, params = []) {
  const url = `${HOST}/api/2.0/sql/statements`;

  const body = {
    statement: sql,
    warehouse_id: WAREHOUSE_ID,
    parameters: params,
    wait_timeout: "30s",
    on_wait_timeout: "CONTINUE",
    disposition: "INLINE",
    format: "JSON_ARRAY",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Databricks API error ${res.status}: ${text}`);
  }

  let data = await res.json();

  if (data.status?.state === "RUNNING" || data.status?.state === "PENDING") {
    const statementId = data.statement_id;
    console.log(`[databricks] Warehouse warming up — polling statement ${statementId}…`);
    data = await pollStatement(statementId);
  }

  if (data.status?.state === "FAILED") {
    throw new Error("Query failed: " + JSON.stringify(data.status?.error));
  }

  return parseResult(data);
}

async function pollStatement(statementId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  const pollUrl = `${HOST}/api/2.0/sql/statements/${statementId}`;
  let delay = 500;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));

    delay = Math.min(delay * 2, 5000);

    const res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Databricks poll error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const state = data.status?.state;

    if (state === "SUCCEEDED") {
      console.log(`[databricks] Statement ${statementId} succeeded.`);
      return data;
    }
    if (state === "FAILED" || state === "CANCELED" || state === "CLOSED") {
      throw new Error(`Statement ${statementId} ended with state ${state}: ` + JSON.stringify(data.status?.error));
    }

  }

  throw new Error(`Databricks statement ${statementId} did not complete within ${POLL_TIMEOUT_MS / 1000}s`);
}

function parseResult(data) {
  const columns = data.manifest?.schema?.columns?.map((c) => c.name) ?? [];
  const rows = data.result?.data_array ?? [];

  return rows.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

let cacheTableReady = false;

async function ensureCacheTable() {
  if (cacheTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
      cache_id       STRING,
      account_id     STRING,
      account_name   STRING,
      researched_at  TIMESTAMP,
      model_pipeline STRING,
      synthesis      STRING,
      confidence     DOUBLE,
      tasks_planned  INT,
      tasks_executed INT
    )
    USING DELTA
  `);
  cacheTableReady = true;
}

export function writeResearchCache(accountId, accountName, pipeline, result) {
  (async () => {
    try {
      await ensureCacheTable();

      const cacheId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const synthesis = JSON.stringify(result ?? {});
      const confidence = result?.confidence_score ?? result?.average_confidence ?? null;
      const planned = result?.tasks_planned ?? null;
      const executed = result?.tasks_executed ?? null;

      await query(`
        INSERT INTO ${CACHE_TABLE}
          (cache_id, account_id, account_name, researched_at, model_pipeline, synthesis, confidence, tasks_planned, tasks_executed)
        VALUES (
          :cache_id, :account_id, :account_name, CURRENT_TIMESTAMP(), :pipeline, :synthesis, :confidence, :planned, :executed
        )
      `, [
        { name: "cache_id", value: cacheId, type: "STRING" },
        { name: "account_id", value: accountId, type: "STRING" },
        { name: "account_name", value: accountName, type: "STRING" },
        { name: "pipeline", value: pipeline, type: "STRING" },
        { name: "synthesis", value: synthesis, type: "STRING" },
        { name: "confidence", value: confidence !== null ? String(confidence) : null, type: "DOUBLE" },
        { name: "planned", value: planned !== null ? String(planned) : null, type: "INT" },
        { name: "executed", value: executed !== null ? String(executed) : null, type: "INT" }
      ]);
    } catch (err) {
      console.error(`[research_cache] Failed to write cache for ${accountId}:`, err.message);
    }
  })();
}

/**
 * Fetch the most recent cached research result for an account.
 * Returns the row object or null if none exists.
 */
export async function getLatestResearch(accountId) {
  try {
    await ensureCacheTable();
    const rows = await query(
      `SELECT * FROM ${CACHE_TABLE} WHERE account_id = :account_id ORDER BY researched_at DESC LIMIT 1`,
      [{ name: "account_id", value: accountId, type: "STRING" }]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error(`[research_cache] getLatestResearch failed for ${accountId}:`, err.message);
    return null;
  }
}

/**
 * Fetch the N most recent cache entries for an account (summary only, no synthesis blob).
 */
export async function getResearchHistory(accountId, limit = 5) {
  try {
    await ensureCacheTable();
    const rows = await query(
      `SELECT cache_id, account_id, account_name, researched_at, model_pipeline, confidence, tasks_planned, tasks_executed
       FROM ${CACHE_TABLE}
       WHERE account_id = :account_id
       ORDER BY researched_at DESC
       LIMIT :limit`,
      [
        { name: "account_id", value: accountId, type: "STRING" },
        { name: "limit", value: String(limit), type: "INT" }
      ]
    );
    return rows;
  } catch (err) {
    console.error(`[research_cache] getResearchHistory failed for ${accountId}:`, err.message);
    return [];
  }
}