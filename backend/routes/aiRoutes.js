import { writeResearchCache } from "../services/dataService.js";
import { fetchAllAccounts, fetchAccountById, fetchTicketsByAccountId, fetchContactsByAccountId, fetchTelemetryByAccountId } from "../services/dataService.js";
import { generateInvestmentBrief, generatePortfolioSummary } from "../services/aiService.js";
import { logAIQuery } from "../services/governanceService.js";
import { MODELS } from "../ai.client.js";
import { z } from "zod";

const asyncHandler = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`[${req.path}]`, err.message);
        if (err instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: "Validation failed", issues: err.issues });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};

const AccountIdSchema = z.object({
    id: z.string()
});

export function registerAIRoutes(app) {
    app.get("/api/portfolio-summary", asyncHandler(async (req, res) => {
        const accounts = await fetchAllAccounts();
        const result = await generatePortfolioSummary(accounts);

        logAIQuery({
            query_type: "portfolio_summary",
            model: MODELS.GEMINI_3_1_PRO_PREVIEW,
            account_ids: accounts.map((a) => a.account_id),
            data_fields_accessed: ["accounts"],
            input_summary: `Portfolio summary for ${accounts.length} accounts`,
            output_summary: result.summary?.bullets?.[0]?.slice(0, 100) || "",
            pii_redacted: true,
            confidence_score: null,
            ip_address: req.governanceSession?.ip,
            session_id: req.governanceSession?.session_id,
        });

        res.json({ success: true, account_count: accounts.length, ...result });
    }));

    app.get("/api/research-account/:id", asyncHandler(async (req, res) => {
        const { id } = AccountIdSchema.parse(req.params);
        const [account, ticketRows, contactRows, telemetryRows] = await Promise.all([
            fetchAccountById(id),
            fetchTicketsByAccountId(id),
            fetchContactsByAccountId(id),
            fetchTelemetryByAccountId(id, 30),
        ]);

        if (!account) return res.status(404).json({ success: false, error: `Account ${id} not found` });
        const result = await generateInvestmentBrief(account, ticketRows, contactRows, telemetryRows);

        res.json({
            success: result.success,
            account_id: id,
            account_name: account.account_name,
            data_sources: { account: 1, support_tickets: ticketRows.length, contacts: contactRows.length, telemetry: telemetryRows.length },
            ...result.brief,
            usage: result.usage,
            error: result.error,
            raw: result.raw
        });
    }));
}
