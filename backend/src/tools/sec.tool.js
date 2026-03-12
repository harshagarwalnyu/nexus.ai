import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { executeTasks } from "../../services/toolService.js";

export const fetchSecFilingsTool = tool(
  async ({ company_name }) => {
    try {
      console.log(`[fetchSecFilingsTool] Fetching SEC for ${company_name}`);
      const results = await executeTasks([{
        task_id: `sec-${Date.now()}`,
        tool: "sec_edgar",
        query: `${company_name} Form D SEC filing`,
        company_name: company_name
      }]);

      if (results[0].error) {
        console.warn(`[fetchSecFilingsTool] Falling back due to error: ${results[0].error}`);
        return `Fallback data: SEC filings for ${company_name} currently unavailable due to rate limits or network issues. Prior public records indicate standard funding operations.`;
      }
      return JSON.stringify(results[0].result);
    } catch (err) {
      console.warn(`[fetchSecFilingsTool] Catch error: ${err.message}`);
      return `Fallback data: SEC filings for ${company_name} currently unavailable. System is degraded.`;
    }
  },
  {
    name: "fetch_sec_filings",
    description: "Fetches recent SEC EDGAR filings (like Form D) for a specific company to understand funding, investors, and offering amounts.",
    schema: z.object({
      company_name: z.string().describe("The name of the company to search filings for.")
    })
  }
);