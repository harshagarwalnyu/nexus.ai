import { fetchAllAccounts, fetchTicketsByAccountId, fetchTelemetryByAccountId } from "../services/dataService.js";

const asyncHandler = (fn) => async (req, res) => {
    try {
        const data = await fn(req);
        res.json({ success: true, count: Array.isArray(data) ? data.length : undefined, data });
    } catch (err) {
        console.error(`[${req.path}] Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

export function registerAccountRoutes(app) {
    app.get("/api/health", (req, res) => {
        const s = {
            databricks: { ok: !!(process.env.DATABRICKS_TOKEN && process.env.DATABRICKS_HOST), error: !process.env.DATABRICKS_TOKEN ? "DATABRICKS_TOKEN not set" : undefined },
            gemini: { ok: !!process.env.GEMINI_API_KEY, error: !process.env.GEMINI_API_KEY ? "GEMINI_API_KEY not set" : undefined },
        };
        const allOk = Object.values(s).every(x => x.ok);
        res.status(allOk ? 200 : 503).json({ status: allOk ? "healthy" : "degraded", timestamp: new Date().toISOString(), services: s });
    });

    app.get("/api/accounts", asyncHandler(() => fetchAllAccounts()));
    app.get("/api/support-tickets", asyncHandler((req) => fetchTicketsByAccountId(req.query.account_id)));
    app.get("/api/telemetry", asyncHandler((req) => fetchTelemetryByAccountId(req.query.account_id)));
}