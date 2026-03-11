import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { query } from "../../services/dataService.js";

const SCHEMA_HINT = `
Available tables and their EXACT columns (use fully qualified names):

nexus_catalog.raw_data.accounts
  account_id, account_name, industry, annual_contract_value,
  contract_renewal_date, assigned_rep, region,
  days_since_last_contact, health_archetype, account_tier,
  hq_lat, hq_lng, created_at

nexus_catalog.raw_data.telemetry
  account_id, recorded_at, admin_logins, feature_usage_depth,
  session_duration_avg_mins, api_calls, active_users

nexus_catalog.raw_data.support_tickets
  ticket_id, account_id, subject, priority, severity, status,
  category, created_at, resolved_at, resolution_hours

nexus_catalog.raw_data.contacts
  contact_id, account_id, name, role, email,
  email_response_time_hrs, last_meeting_days_ago,
  previous_account_id, linkedin_connections_to_reps

health_archetype values: 'expanding', 'healthy', 'at_risk', 'dormant'
account_tier values: 'T1', 'T2', 'T3'
priority values: 'P1', 'P2', 'P3', 'P4'
`.trim();

const MAX_RESULT_CHARS = 8000;

function truncateResult(json) {
  if (json.length <= MAX_RESULT_CHARS) return json;
  return json.slice(0, MAX_RESULT_CHARS) + "\n... [TRUNCATED — use LIMIT or narrower WHERE to see more]";
}

export const queryCRMTool = tool(
  async ({ sql_query }) => {
    try {
      console.log(`[queryCRMTool] Executing: ${sql_query}`);

      if (!sql_query.toLowerCase().includes("limit")) {
        sql_query += " LIMIT 25";
      }
      const rows = await query(sql_query);
      const result = JSON.stringify(rows, null, 2);
      return truncateResult(result);
    } catch (err) {
      return `Error querying CRM: ${err.message}`;
    }
  },
  {
    name: "query_crm",
    description: `Queries the Nexus Databricks CRM. Use ONLY the exact column names below. Always include LIMIT (max 25). Select only columns you need — avoid SELECT *.\n\n${SCHEMA_HINT}`,
    schema: z.object({
      sql_query: z.string().describe("SQL query using ONLY the exact columns listed in the schema. Always use fully qualified table names (e.g. nexus_catalog.raw_data.accounts). Always include LIMIT 25 or less.")
    })
  }
);