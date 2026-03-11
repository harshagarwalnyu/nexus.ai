import { query, getLatestResearch, getResearchHistory } from "../services/dataService.js";
import { createJob, startJob, getJob, listJobs } from "../services/jobService.js";
import { orchestratedResearch } from "../services/researchService.js";
import { runSimulationAsync } from "../services/quant_engine_pool.js";
import { SemanticMemory } from "../services/semantic_core.js";
import { tableToIPC } from "apache-arrow";
import multer from 'multer';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { callModel } from "../ai.client.js";
import { z } from "zod";
import { validateAIResponse } from "../validator.js";

const upload = multer({ dest: 'uploads/' });
const CATALOG = process.env.DATABRICKS_CATALOG;
const SCHEMA = process.env.DATABRICKS_SCHEMA;
const semanticMemory = new SemanticMemory();

const ResearchTriggerSchema = z.object({
    account_ids: z.array(z.string()).min(1),
    depth: z.enum(["standard", "deep"]).default("standard"),
    callback_url: z.string().url().optional(),
    user_instruction: z.string().optional()
});

const OrchestratedResearchSchema = z.object({
    account_id: z.string()
});

const DebateSchema = z.object({
    account_id: z.string()
});

const RebuttalSchema = z.object({
    account_id: z.string(),
    threat: z.string(),
    rebuttal: z.string()
});

const IngestSchema = z.object({
    docId: z.string(),
    text: z.string()
});

const SearchSchema = z.object({
    query: z.string()
});

import { DebateSwarm } from "../services/research/DebateSwarm.js";
import { WarRoom } from "../services/research/WarRoom.js";

const asyncHandler = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`[${req.path}] Error:`, err.message);
        if (err instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: "Validation failed", issues: err.issues });
        }
        if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    }
};

const parseSynthesis = (cached) => {
    try {
        const synthesis = typeof cached.synthesis === "string" ? JSON.parse(cached.synthesis) : cached.synthesis;
        return synthesis || {};
    } catch {
        return {};
    }
};

export function registerResearchRoutes(app) {
    app.post("/api/v1/research/trigger", asyncHandler(async (req, res) => {
        const { account_ids, depth, callback_url, user_instruction } = ResearchTriggerSchema.parse(req.body);

        const { job_id } = createJob(account_ids, depth, { callbackUrl: callback_url, userInstruction: user_instruction ?? "" });
        await startJob(job_id, async (accountId) => {
            const rows = await query(`SELECT account_id, account_name, industry, health_archetype FROM ${CATALOG}.${SCHEMA}.accounts WHERE account_id = :accountId LIMIT 1`, [{ name: "accountId", value: accountId, type: "STRING" }]);
            return rows[0] ?? null;
        });
        res.status(202).json({ research_job_id: job_id, status: "running" });
    }));

    app.get("/api/v1/research/status/:jobId", (req, res) => {
        const job = getJob(req.params.jobId);
        job ? res.json(job) : res.status(404).json({ error: `Job ${req.params.jobId} not found` });
    });

    app.get("/api/v1/research/jobs", (req, res) => res.json({ jobs: listJobs() }));

    app.get("/api/v1/research/cache/:accountId", asyncHandler(async (req, res) => {
        const [latest, history] = await Promise.all([getLatestResearch(req.params.accountId), getResearchHistory(req.params.accountId, 5)]);
        res.json({ success: true, latest, history });
    }));

    app.post("/api/v1/orchestrated-research", asyncHandler(async (req, res) => {
        const { account_id } = OrchestratedResearchSchema.parse(req.body);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const sendEvent = (event) => !res.writableEnded && res.write(`data: ${JSON.stringify(event)}\n\n`);

        try {
            const [accountRows, ticketRows, contactRows] = await Promise.all([
                query(`SELECT * FROM ${CATALOG}.${SCHEMA}.accounts WHERE account_id = :account_id LIMIT 1`, [{ name: "account_id", value: account_id, type: "STRING" }]),
                query(`SELECT * FROM ${CATALOG}.${SCHEMA}.support_tickets WHERE account_id = :account_id ORDER BY created_at DESC LIMIT 10`, [{ name: "account_id", value: account_id, type: "STRING" }]),
                query(`SELECT * FROM ${CATALOG}.${SCHEMA}.contacts WHERE account_id = :account_id`, [{ name: "account_id", value: account_id, type: "STRING" }]),
            ]);

            if (!accountRows.length) {
                sendEvent({ type: "error", error: `Account ${account_id} not found` });
                return res.end();
            }

            const result = await orchestratedResearch(accountRows[0], ticketRows, contactRows, { onProgress: (p) => sendEvent({ type: "progress", ...p }) });
            sendEvent({ type: "done", result });
        } catch (err) {
            sendEvent({ type: "error", error: err.message });
        } finally {
            res.end();
        }
    }));

    app.get("/api/v1/simulation/:revenue", asyncHandler(async (req, res) => {
        const revenue = parseFloat(req.params.revenue) || 100_000_000;
        try {
            const ipcBuffer = await runSimulationAsync(revenue);
            res.setHeader("Content-Type", "application/vnd.apache.arrow.stream");
            res.setHeader("X-Simulation-Engine", "QuantCore-v1");
            res.send(Buffer.from(ipcBuffer));
        } catch (err) {
            res.status(500).json({ error: "Simulation failed", details: err.message });
        }
    }));

    app.post("/api/v1/semantic/ingest", asyncHandler(async (req, res) => {
        const { docId, text } = IngestSchema.parse(req.body);
        await semanticMemory.ingest(docId, [{ text: text, metadata: { source: "upload" } }]);
        res.json({ success: true });
    }));

    app.post("/api/v1/semantic/search", asyncHandler(async (req, res) => {
        const { query: searchQuery } = SearchSchema.parse(req.body);
        res.json({ results: await semanticMemory.query(searchQuery) });
    }));

    app.post("/api/v1/research/debate", asyncHandler(async (req, res) => {
        const { account_id } = DebateSchema.parse(req.body);

        const cached = await getLatestResearch(account_id);
        if (!cached) return res.status(404).json({ error: "No research found." });

        cached.synthesis = parseSynthesis(cached);
        const debateSwarm = new DebateSwarm(cached);
        const debateResult = await debateSwarm.runDebate();

        res.json({ success: true, debate: debateResult });
    }));

    app.post("/api/v1/research/warroom/threats", asyncHandler(async (req, res) => {
        const { account_id } = DebateSchema.parse(req.body);

        const cached = await getLatestResearch(account_id);
        if (!cached) return res.status(404).json({ error: "No research found." });

        cached.synthesis = parseSynthesis(cached);
        const warRoom = new WarRoom(cached);
        const threats = await warRoom.generateThreats();

        res.json({ success: true, threats });
    }));

    app.post("/api/v1/research/warroom/rebuttal", asyncHandler(async (req, res) => {
        const { account_id, threat, rebuttal } = RebuttalSchema.parse(req.body);

        const cached = await getLatestResearch(account_id);
        if (!cached) return res.status(404).json({ error: "No research found." });

        cached.synthesis = parseSynthesis(cached);
        const warRoom = new WarRoom(cached);
        const evaluation = await warRoom.evaluateRebuttal(threat, rebuttal);

        res.json({ success: true, evaluation });
    }));

    app.get("/api/v1/research/graph/:accountId", asyncHandler(async (req, res) => {
        const cached = await getLatestResearch(req.params.accountId);
        if (!cached) return res.status(404).json({ error: "No research found" });

        const synthesis = parseSynthesis(cached);
        const nodes = [{ id: "root", label: cached.account_name, type: "company", val: 20 }];
        const links = [];

        (synthesis.key_findings || []).forEach((f, i) => {
            const findingId = `finding-${i}`;
            nodes.push({ id: findingId, label: f.title, type: "finding", val: 10, impact: f.impact });
            links.push({ source: "root", target: findingId, type: "impact" });
            if (f.source) {
                nodes.push({ id: `source-${i}`, label: f.source, type: "source", val: 5 });
                links.push({ source: findingId, target: `source-${i}`, type: "citation" });
            }
        });

        (synthesis.risks || []).forEach((r, i) => {
            nodes.push({ id: `risk-${i}`, label: r, type: "risk", val: 8 });
            links.push({ source: "root", target: `risk-${i}`, type: "risk" });
        });

        res.json({ nodes, links });
    }));

    app.post("/api/v1/research/feedback", (req, res) => {
        console.log(`[RLHF] Feedback: Winner=${req.body.winner}, Comment=${req.body.comment?.slice(0, 50)}...`);
        res.json({ success: true });
    });

    app.post("/api/v1/research/upload", upload.single('file'), asyncHandler(async (req, res) => {
        const file = req.file;
        const { account_id } = req.body;

        if (!file || !account_id) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ error: "File and account_id required" });
        }

        try {
            let extractedText = "";
            if (file.originalname.endsWith('.zip')) {
                new AdmZip(file.path).getEntries().forEach(entry => {
                    if (!entry.isDirectory && (entry.entryName.endsWith('.txt') || entry.entryName.endsWith('.md'))) {
                        extractedText += `\n--- FILE: ${entry.entryName} ---\n${entry.getData().toString('utf8')}\n`;
                    }
                });
            } else {
                extractedText = fs.readFileSync(file.path, 'utf8');
            }

            const prompt = `Review this document for ${account_id}. Identify any red flags. Return ONLY a valid JSON object with "has_flags" (boolean) and "flags" (array of strings). Document: ${extractedText.slice(0, 5000)}`;
            const aiRes = await callModel({ messages: [{ role: "user", content: prompt }] });

            const auditSchema = z.object({
                has_flags: z.boolean(),
                flags: z.array(z.string())
            });

            const validation = validateAIResponse(auditSchema, aiRes.content);
            res.json({ success: validation.success, filename: file.originalname, audit: validation.success ? validation.data : { has_flags: false, flags: [] } });
        } finally {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
    }));
}