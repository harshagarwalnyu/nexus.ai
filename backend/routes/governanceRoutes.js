import { getAIQueryAuditReport, getColumnMetadata, applyUnityCatalogTags } from "../services/governanceService.js";

const asyncHandler = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`[${req.path}] Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

export function registerGovernanceRoutes(app) {
    app.get("/api/v1/governance/audit-report", asyncHandler(async (req, res) => {
        const report = await getAIQueryAuditReport(parseInt(req.query.days ?? "30", 10));
        res.json({ success: true, ...report });
    }));

    app.get("/api/v1/governance/column-metadata", asyncHandler(async (req, res) => {
        const { table = "accounts" } = req.query;
        const metadata = await getColumnMetadata(table);
        res.json({ success: true, table, columns: metadata });
    }));

    app.post("/api/v1/governance/apply-tags", asyncHandler(async (req, res) => {
        const results = await applyUnityCatalogTags();
        res.json({ success: true, results });
    }));
}