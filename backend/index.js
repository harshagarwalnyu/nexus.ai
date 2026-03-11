import { validateEnv } from "./env.js";

validateEnv();

import express from "express";
import cors from "cors";
import compression from "compression";
import { initSlackBot, startSlackBot } from "./integrations/slack.js";
import { initSubscribers } from "./subscribers.js";
import { requireAuth } from "./middleware/auth.js";
import { maskPII } from "./middleware/pii.js";
import {
  governanceMiddleware,
} from "./services/governanceService.js";

const app = express();
const PORT = process.env.PORT || 3001;
const CATALOG = process.env.DATABRICKS_CATALOG;
const SCHEMA = process.env.DATABRICKS_SCHEMA;
import { registerAccountRoutes } from "./routes/accountRoutes.js";
import { registerAIRoutes } from "./routes/aiRoutes.js";
import { registerReportRoutes } from "./routes/reportRoutes.js";
import { registerRiskRoutes } from "./routes/riskRoutes.js";
import { registerGovernanceRoutes } from "./routes/governanceRoutes.js";
import { registerResearchRoutes } from "./routes/researchRoutes.js";
import { registerChatRoutes } from "./routes/chatRoutes.js";
import { registerComplianceRoutes } from "./routes/complianceRoutes.js";
import { registerRealtimeRoutes } from "./routes/realtimeRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import { runSimulationAsync } from "./services/quant_engine_pool.js";
import { getLatestResearch } from "./services/dataService.js";
import { SemanticMemory } from "./services/semantic_core.js";

app.use(compression());
app.use(cors({
  origin: (origin, cb) => {

    if (!origin) return cb(null, true);

    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json());

app.use(maskPII);

app.use((req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=300");
  } else {
    res.set("Cache-Control", "no-store");
  }
  next();
});

app.use("/api/v1", requireAuth);

app.use(governanceMiddleware);

registerAccountRoutes(app);
registerAIRoutes(app);
registerReportRoutes(app);
registerRiskRoutes(app);
registerGovernanceRoutes(app);
registerResearchRoutes(app);
registerChatRoutes(app);
registerComplianceRoutes(app);
registerRealtimeRoutes(app);

app.use("/api/v1/ingestion", ingestionRoutes);

app.get("/api/v1/simulation/:revenue", async (req, res, next) => {
  const revenue = parseFloat(req.params.revenue) || 100_000_000;
  try {
    const ipcBuffer = await runSimulationAsync(revenue);
    res.set({
      "Content-Type": "application/vnd.apache.arrow.stream",
      "X-Simulation-Engine": "QuantCore-v1",
    });
    return res.send(Buffer.from(ipcBuffer));
  } catch (err) {
    next(err);
  }
});

app.get("/api/v1/research/graph/:accountId", async (req, res, next) => {
  const accountId = req.params.accountId;
  try {
    const cached = await getLatestResearch(accountId);
    if (!cached) return res.status(404).json({ error: "No research found" });

    let synthesis;
    try {
      synthesis = typeof cached.synthesis === "string" ? JSON.parse(cached.synthesis) : cached.synthesis;
    } catch {
      return res.status(500).json({ error: "Failed to parse synthesis" });
    }

    const nodes = [{ id: "root", label: cached.account_name, type: "company", val: 20 }];
    const links = [];

    (synthesis.key_findings || []).forEach((f, i) => {
      const findingId = `finding-${i}`;
      nodes.push({ id: findingId, label: f.title, type: "finding", val: 10, impact: f.impact });
      links.push({ source: "root", target: findingId, type: "impact" });
      if (f.source) {
        const sourceId = `source-${i}`;
        nodes.push({ id: sourceId, label: f.source, type: "source", val: 5 });
        links.push({ source: findingId, target: sourceId, type: "citation" });
      }
    });

    (synthesis.risks || []).forEach((r, i) => {
      const riskId = `risk-${i}`;
      nodes.push({ id: riskId, label: r, type: "risk", val: 8 });
      links.push({ source: "root", target: riskId, type: "risk" });
    });

    return res.json({ nodes, links });
  } catch (err) {
    next(err);
  }
});

const semanticMemory = new SemanticMemory();

app.post("/api/v1/semantic/ingest", async (req, res) => {
  const { docId, text } = req.body;
  await semanticMemory.ingest(docId, [text]);
  return res.json({ success: true });
});

app.post("/api/v1/semantic/search", async (req, res, next) => {
  const { query } = req.body;
  try {
    const results = await semanticMemory.query(query);
    return res.json({ results });
  } catch (err) {
    next(err);
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[express-error] ${req.method} ${req.path} :`, err.stack || err.message);
    
    const isProd = process.env.NODE_ENV === "production";
    const status = err.status || 500;
    
    res.status(status).json({
        error: isProd ? "Internal Server Error" : err.message,
        details: isProd ? "An unexpected error occurred. Please contact support." : (err.details || err.stack),
        code: err.code || "INTERNAL_ERROR"
    });
});

import { initWebSocket } from "./websocket.js";

const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Nexus backend running on http://localhost:${PORT}`);
  console.log(`   Databricks : ${process.env.DATABRICKS_HOST}`);
  console.log(`   Engine     : ${process.env.GEMINI_API_KEY ? "✅ configured" : "❌ GEMINI_API_KEY missing"}`);
  console.log(`   Catalog    : ${CATALOG}.${SCHEMA}`);

  Promise.resolve().then(async () => {
    try {
      initSlackBot();
      await startSlackBot();
      await initSubscribers();
    } catch (err) {
      console.warn(`   Slack/NATS : ⚠️  failed to start (${err.message})`);
    }
  }).catch((err) => {
    console.warn(`   Slack/NATS : ⚠️  failed to start (${err.message})`);
  });

  console.log("");
});

initWebSocket(server);