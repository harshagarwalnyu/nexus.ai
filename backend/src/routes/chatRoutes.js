import { chatStream, extractChatContext } from "../services/aiService.js";
import { MODELS } from "../ai.client.js";
import { z } from "zod";

const chatRequestSchema = z.object({
    messages: z.array(z.record(z.string(), z.unknown())).min(1, "messages array required"),
    model: z.string().optional(),
    account_ids: z.array(z.string()).optional(),
    external_sources: z.boolean().optional(),
    human_review: z.boolean().optional()
}).passthrough();

const extractContextSchema = z.object({
    messages: z.array(z.record(z.string(), z.unknown())).min(1, "messages array required")
}).passthrough();

const asyncHandler = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`[${req.path}] Error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

export function registerChatRoutes(app) {
    app.post("/api/chat", asyncHandler(async (req, res) => {
        const parsed = chatRequestSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid request payload", details: parsed.error.format() });

        const { messages, model, human_review } = parsed.data;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        await chatStream(messages, res, "", model || MODELS.GEMINI_2_PRO, !!human_review);
    }));

    app.post("/api/chat/extract-context", asyncHandler(async (req, res) => {
        const parsed = extractContextSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid request payload", details: parsed.error.format() });

        const context = await extractChatContext(parsed.data.messages);
        res.json({ success: true, ...context });
    }));
}