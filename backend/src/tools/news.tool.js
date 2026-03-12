import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { executeTasks } from "../../services/toolService.js";

export const fetchMarketNewsTool = tool(
  async ({ query }) => {
    try {
      console.log(`[fetchMarketNewsTool] Searching for: ${query}`);
      const results = await executeTasks([{
        task_id: `news-${Date.now()}`,
        tool: "news_api",
        query: query
      }]);

      if (results[0].error) {
        console.warn(`[fetchMarketNewsTool] Falling back due to error: ${results[0].error}`);
        return `Fallback data: News for "${query}" currently unavailable due to rate limits. Assume normal market conditions with no major breaking volatility.`;
      }
      return JSON.stringify(results[0].result);
    } catch (err) {
      console.warn(`[fetchMarketNewsTool] Catch error: ${err.message}`);
      return `Fallback data: News unavailable. System is degraded.`;
    }
  },
  {
    name: "fetch_market_news",
    description: "Fetches recent market and financial news headlines based on a search query (e.g., 'Zoom margin compression', 'Target logistics costs').",
    schema: z.object({
      query: z.string().describe("The search terms to query for news.")
    })
  }
);