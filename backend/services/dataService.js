import * as databricks from "./databricksService.js";
import * as duckdb from "./duckdbService.js";

const USE_LOCAL = process.env.USE_LOCAL_DB === "true" || !process.env.DATABRICKS_HOST;
const provider = USE_LOCAL ? duckdb : databricks;
const CATALOG = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "raw_data";

export const query = provider.query;
export const writeResearchCache = provider.writeResearchCache;
export const getLatestResearch = provider.getLatestResearch;
export const getResearchHistory = provider.getResearchHistory;

export async function fetchAccountById(id) {
  const rows = await query(`SELECT * FROM ${CATALOG}.${SCHEMA}.accounts WHERE account_id = :id LIMIT 1`, [
    { name: "id", value: id, type: "STRING" }
  ]);
  return rows[0] || null;
}

export async function fetchAllAccounts() {
  return query(`SELECT * FROM ${CATALOG}.${SCHEMA}.accounts ORDER BY annual_contract_value DESC`);
}

export async function fetchTicketsByAccountId(accountId, limit = 50) {
  return query(`SELECT * FROM ${CATALOG}.${SCHEMA}.support_tickets WHERE account_id = :accountId ORDER BY created_at DESC LIMIT :limit`, [
    { name: "accountId", value: accountId, type: "STRING" },
    { name: "limit", value: String(limit), type: "INT" }
  ]);
}

export async function fetchTelemetryByAccountId(accountId, limit = 100) {
  return query(`SELECT * FROM ${CATALOG}.${SCHEMA}.telemetry WHERE account_id = :accountId ORDER BY recorded_at DESC LIMIT :limit`, [
    { name: "accountId", value: accountId, type: "STRING" },
    { name: "limit", value: String(limit), type: "INT" }
  ]);
}

export async function fetchContactsByAccountId(accountId) {
  return query(`SELECT * FROM ${CATALOG}.${SCHEMA}.contacts WHERE account_id = :accountId`, [
    { name: "accountId", value: accountId, type: "STRING" }
  ]);
}

export async function fetchHighValueAtRisk(acvThreshold = 1500000) {
  return query(`SELECT * FROM ${CATALOG}.${SCHEMA}.accounts WHERE (health_archetype = 'dormant' OR health_archetype = 'at_risk') AND annual_contract_value > :threshold ORDER BY annual_contract_value DESC`, [
    { name: "threshold", value: String(acvThreshold), type: "DOUBLE" }
  ]);
}
