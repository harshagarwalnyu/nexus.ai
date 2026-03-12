import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { executeTasks } from "../../services/toolService.js";

export const webSearchTool = tool(
  async ({ query }) => {
    try {
      console.log(`[webSearchTool] Searching: ${query}`);
      const results = await executeTasks([{
        task_id: `web-${Date.now()}`,
        tool: "web_search",
        query,
      }]);

      const r = results[0];
      if (r.error) return `Web search unavailable: ${r.error}`;

      const data = r.result;
      if (typeof data === "string") return data.slice(0, 6000);

      const items = data?.results ?? data?.data ?? [];
      if (Array.isArray(items) && items.length) {
        return items
          .slice(0, 8)
          .map((item, i) => `[${i + 1}] ${item.title || ""}\n${item.snippet || item.description || ""}\nSource: ${item.url || item.link || ""}`)
          .join("\n\n")
          .slice(0, 6000);
      }

      return JSON.stringify(data).slice(0, 6000);
    } catch (err) {
      return `Web search error: ${err.message}`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for real-time information about any company, market event, earnings, news, or public financial data. Use this when the CRM or SEC tools don't have enough data — especially for questions about public companies (stock performance, recent news, earnings calls, market position).",
    schema: z.object({
      query: z.string().describe("Specific search query, e.g. 'Boeing Q4 2024 earnings results' or 'Microsoft Azure revenue growth 2025'"),
    }),
  }
);