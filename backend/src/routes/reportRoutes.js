import { generatePDF, generateDOCX } from "../services/reportService.js";
import { getAuditLog, auditLog } from "../services/auditService.js";

function rbacSubscriber(req, res, next) {
    if ((req.headers['x-user-role'] || 'guest') !== 'subscriber') {
        return res.status(403).json({ success: false, error: "Access Denied: Subscriber role required for enterprise reports." });
    }
    next();
}

export function registerReportRoutes(app) {
    app.post("/api/v1/reports/generate", rbacSubscriber, async (req, res) => {
        try {
            const { type, account_id, data } = req.body;
            if (!type || !account_id || !data) return res.status(400).json({ success: false, error: "Type, account_id and data are required" });

            console.log(`[/api/v1/reports/generate] Generating ${type} for account ${account_id}...`);
            const result = type === "pdf" ? await generatePDF(data) : type === "docx" ? await generateDOCX(data) : null;
            if (!result) return res.status(400).json({ success: false, error: "Invalid report type" });

            await auditLog("generate_report", { account_id, status: "ok", details: { type, user: req.governanceSession?.user_id || "system" } });
            res.json({ success: true, ...result });
        } catch (err) {
            console.error("[/api/v1/reports/generate]", err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get("/api/v1/audit-log", rbacSubscriber, async (req, res) => {
        try {
            const logs = await getAuditLog();
            res.json({ success: true, count: logs.length, data: logs });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
}