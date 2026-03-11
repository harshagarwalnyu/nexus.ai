import crypto from "crypto";
import { query } from "./dataService.js";

/**
 * Record the lineage of a generated report or AI synthesis.
 */
export async function recordLineage({
  target_id,
  target_type,
  sources, // Array of { type: 'table'|'api', name: 'accounts', id: 'ACC-0001' }
  model,
  user_id,
  tenant_id
}) {
  const lineage_id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const entry = {
    lineage_id,
    target_id,
    target_type,
    sources: JSON.stringify(sources),
    model_used: model,
    generated_by: user_id,
    tenant_id,
    created_at: timestamp
  };

  try {

    await query(`
      INSERT INTO nexus_catalog.security.data_lineage (
        lineage_id, target_id, target_type, sources, model_used, generated_by, tenant_id, created_at
      ) VALUES (
        :lineage_id, :target_id, :target_type, :sources, :model_used, :generated_by, :tenant_id, :created_at
      )
    `, [
      { name: "lineage_id", value: entry.lineage_id },
      { name: "target_id", value: entry.target_id },
      { name: "target_type", value: entry.target_type },
      { name: "sources", value: entry.sources },
      { name: "model_used", value: entry.model_used },
      { name: "generated_by", value: entry.generated_by },
      { name: "tenant_id", value: entry.tenant_id },
      { name: "created_at", value: entry.created_at }
    ]);

    return lineage_id;
  } catch (err) {
    console.warn("[provenance] Failed to record lineage:", err.message);
    return null;
  }
}

export async function getLineage(targetId) {
  try {
    return await query(
      `SELECT * FROM nexus_catalog.security.data_lineage WHERE target_id = :targetId ORDER BY created_at DESC`,
      [{ name: "targetId", value: targetId }]
    );
  } catch (err) {
    return [];
  }
}

export function generateReportHash(reportContent) {
  const contentString =
    typeof reportContent === "string"
      ? reportContent
      : JSON.stringify(reportContent);

  const hash = crypto.createHash("sha256");
  hash.update(contentString);
  return hash.digest("hex");
}
