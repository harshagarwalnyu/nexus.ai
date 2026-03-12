import { z } from "zod";

export const InvestmentBriefSchema = z.object({
    executive_summary: z.string().min(10),
    health_verdict: z.object({
        archetype: z.enum(["healthy", "expanding", "dormant", "at_risk"]),
        confidence: z.number().min(0).max(100),
        rationale: z.string()
    }),
    key_signals: z.array(z.object({
        type: z.enum(["positive", "negative", "neutral"]),
        signal: z.string(),
        implication: z.string()
    })),
    risks: z.array(z.string()),
    opportunities: z.array(z.string()),
    recommended_action: z.object({
        priority: z.enum(["immediate", "high", "medium", "low"]),
        action: z.string(),
        rationale: z.string()
    }),
    thesis_brief: z.string().min(20),
    data_freshness: z.object({
        last_crm_contact: z.string(),
        generated_at: z.string()
    })
});

export const PortfolioSummarySchema = z.object({
    bullets: z.array(z.string()).min(1),
    risk_level: z.enum(["low", "medium", "high", "critical"]),
    top_opportunity: z.string(),
    top_risk: z.string()
});

export const CriticResultSchema = z.object({
    valid: z.boolean(),
    score: z.number().min(0).max(1),
    issues: z.array(z.string()).optional(),
    sanitizedOutput: z.string().optional()
});

export function validateAIResponse(schema, rawText) {
    try {

        let jsonText = rawText;
        const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
        } else {

            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonText = rawText.slice(firstBrace, lastBrace + 1);
            }
        }

        const parsed = JSON.parse(jsonText);
        const validated = schema.parse(parsed);

        return { success: true, data: validated };
    } catch (err) {
        console.error("[validator] Validation failed:", err.message);
        console.debug("[validator] Raw text that failed:", rawText);
        if (err instanceof z.ZodError) {
            console.error("[validator] Zod Issues:", JSON.stringify(err.issues, null, 2));
        }
        return { success: false, error: err.message, raw: rawText };
    }
}