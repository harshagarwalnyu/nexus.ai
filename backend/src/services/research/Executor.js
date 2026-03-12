import { callModel, routeModel } from "../../ai.client.js";
import { executeTasks } from "../toolService.js";
import { researchCache } from "../../cache.js";

export async function executeResearchTask(task, additionalContext = "") {
  const model = routeModel(task.query, task.priority);

  const systemPrompt = `You are a financial research analyst. Conduct targeted research on the given query.
Be specific, factual, and investment-relevant. Cite any specific events, dates, or data points you know.
Focus on: ${(task.expected_signals || []).join(", ") || "material business events and risks"}.
If you are unsure about specific facts, say so explicitly rather than guessing.
${additionalContext ? `\nContext: ${additionalContext}` : ""}`;

  const userPrompt = `Research task: ${task.query}

Research type: ${task.research_type}
Priority: ${task.priority}
Rationale: ${task.rationale}

Provide:
1. Key findings (be specific with dates/amounts where known)
2. Investment signals identified
3. Confidence level (High/Medium/Low) for each finding
4. What you could NOT determine (knowledge gaps)

Keep response under 500 words.
Return plain text only — no markdown code fences, no JSON wrappers.`;

  const cached = researchCache.get(task.query, model);
  if (cached) {
    return {
      success: true,
      content: cached,
      task_id: task.task_id,
      model: model,
      cached: true
    };
  }

  try {
    const result = await callModel({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
    });

    if (!result.content) throw new Error("Model returned empty response");

    researchCache.set(task.query, model, result.content);

    return {
      success: true,
      content: result.content,
      task_id: task.task_id,
      model: result.model,
      usage: result.usage,
    };
  } catch (err) {
    console.warn(`[orchestrator] ${model} failed for task ${task.task_id}: ${err.message}`);

    if (process.env.NIA_API_KEY) {
      try {
        const niaResult = await niaCrawlFallback(task.query);
        return {
          success: true,
          content: niaResult,
          task_id: task.task_id,
          model: "nia-web-search",
          fallback: true,
        };
      } catch (niaErr) {
        console.warn(`[orchestrator] Nia fallback also failed: ${niaErr.message}`);
      }
    }

    return {
      success: false,
      error: err.message,
      task_id: task.task_id,
    };
  }
}

export async function executeTaskWithRouting(task, additionalContext = "") {
  const TOOLS_JS_TYPES = new Set(["sec_edgar", "financial_api", "news_api"]);

  if (task.tool && TOOLS_JS_TYPES.has(task.tool)) {
    try {
      const toolTask = {
        task_id: task.task_id,
        tool: task.tool,
        query: task.query,
        company_name: task.company_name || "",
        ticker: task.ticker || "",
      };
      const [result] = await executeTasks([toolTask]);

      if (result.error) {

        console.warn(`[orchestrator] tools.js executor failed for ${task.tool}: ${result.error} — falling back to model`);
      } else {

        const content = typeof result.result === "string"
          ? result.result
          : JSON.stringify(result.result, null, 2);
        return { success: true, content, model: task.tool, task_id: task.task_id };
      }
    } catch (err) {
      console.warn(`[orchestrator] tools.js threw for ${task.tool}: ${err.message} — falling back to model`);
    }
  }

  return executeResearchTask(task, additionalContext);
}

async function niaCrawlFallback(query) {
  const res = await fetch(`${process.env.NIA_BASE_URL || "https://apigcp.trynia.ai/v2"}/web-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, num_results: 5 }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`Nia web search HTTP ${res.status}`);
  const json = await res.json();

  const snippets = (json.results || []).map((r) => `${r.title}: ${r.snippet || r.description || ""}`).join("\n");
  return snippets || "No results found via Nia web search.";
}