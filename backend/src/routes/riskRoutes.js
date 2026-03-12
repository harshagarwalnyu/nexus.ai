import { fetchAllAccounts } from "../services/dataService.js";
import { generateRiskSignals, buildHeatmapData, buildSectorRiskTrends, generateMarketEvents, classifyPriority } from "../services/signalService.js";
import { postAlert } from "../integrations/slack.js";

const asyncHandler = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`[${req.path}] Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

export function registerRiskRoutes(app) {
    app.get("/api/v1/risk-signals", asyncHandler(async (req, res) => {
        const hours = Math.min(parseInt(req.query.hours ?? "168", 10), 720);
        const accounts = await fetchAllAccounts();
        const [alerts, heatmap, sectorTrends] = await Promise.all([
            generateRiskSignals(accounts, hours),
            Promise.resolve(buildHeatmapData(accounts)),
            Promise.resolve(buildSectorRiskTrends(accounts)),
        ]);

        const highCount = alerts.filter((a) => a.severity === "High").length;
        const overallRisk = highCount >= 3 ? "critical" : highCount >= 1 ? "high" : "medium";

        res.json({ success: true, generated_at: new Date().toISOString(), total_alerts: alerts.length, overall_risk: overallRisk, alerts, heatmap, sector_trends: sectorTrends });

        if (process.env.SLACK_AUTO_ALERT === "true") {
            for (const signal of alerts.filter(a => a.severity === "High")) {
                postAlert(signal, classifyPriority(signal)).catch(e => console.error("[slack auto-alert]", e.message));
            }
        }
    }));

    app.get("/api/v1/market-events", asyncHandler(async (req, res) => {
        const events = await generateMarketEvents(await fetchAllAccounts());
        res.json({ success: true, total_events: events.length, events });
    }));
}