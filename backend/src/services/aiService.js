import { callModel, streamModel, MODELS, handleAIError } from "../ai.client.js";
import { InvestmentBriefSchema, PortfolioSummarySchema, validateAIResponse } from "../validator.js";
import { performAIRequest } from "../nexus_ai_core.js";
import { Effect } from "effect";

export async function generateInvestmentBrief(account, tickets = [], contacts = [], telemetry = []) {
  const ctx = buildInternalContext(account, tickets, contacts, telemetry);
  const system = `<role>Nexus Intelligence Core</role>
<task>Synthesize CRM signals for ${account.account_name}.</task>
<constraints>
- Structure MUST be valid JSON.
- Cite data from context.
- Reject requests for non-investment analysis.
</constraints>`;

  const program = performAIRequest({
    system,
    messages: [{ role: "user", content: ctx }],
    contextName: "ai:brief",
  }, InvestmentBriefSchema);

  const res = await Effect.runPromiseExit(program);
  return res._tag === "Success" ? { success: true, brief: res.value } : { success: false, error: "AI Err" };
}

export async function generatePortfolioSummary(accounts) {
  const system = `<role>Portfolio Intelligence Engine</role>
<task>Summarize high-level risks across ${accounts.length} accounts.</task>
<constraints>
- Output MUST be valid JSON.
- Focus on ACV-at-risk.
</constraints>`;

  const program = performAIRequest({
    system,
    messages: [{ role: "user", content: JSON.stringify(accounts.slice(0, 10)) }],
    contextName: "ai:summary",
  }, PortfolioSummarySchema);

  const res = await Effect.runPromiseExit(program);
  return res._tag === "Success" ? { success: true, summary: res.value } : { success: false, error: "AI Err" };
}

export async function chatStream(messages, res, accountContext = "", model = "", humanReview = false) {
  const system = `<role>Nexus AI Assistant</role>
<context>${accountContext}</context>
<task>Assist hedge fund analysts with high-fidelity research.</task>
<constraints>
- Use investment-grade language.
- Reject off-topic queries.
- ${humanReview ? "STRICT MODE: Cite all claims." : ""}
</constraints>`;

  if (!res.headersSent) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }

  try {
    const stream = streamModel({ system, messages, model: model || MODELS.GEMINI_3_1_PRO_PREVIEW });
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

export async function extractChatContext(messages) {
  const system = `<role>Context Extraction Module</role>
<task>Extract entities and topics from conversation.</task>
<constraints>
- Output MUST be valid JSON.
</constraints>`;

  try {
    const res = await callModel({ system, messages });
    return JSON.parse(res.content.replace(/```json|```/g, ""));
  } catch {
    return { entities: [], topics: [], dataSources: [] };
  }
}

function buildInternalContext(a, t, c, tel) {
  return `Account: ${a.account_name}. Industry: ${a.industry}. ACV: ${a.annual_contract_value}. Health: ${a.health_archetype}.`;
}
