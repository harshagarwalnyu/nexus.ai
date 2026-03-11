import { callModel, MODELS } from "../ai.client.js";
import { recordLineage } from "./provenanceService.js";

/**
 * Drafts a structured SEC Form (e.g., 10-K, 10-Q, 8-K) summary from raw account/financial data.
 */
export async function draftSECForm(formType, rawData, context = {}) {
  const { account_id, user_id, tenant_id } = context;

  const prompt = `
You are a highly capable AI assistant specializing in corporate compliance and SEC filings.
Draft a professional summary for an SEC-compliant ${formType} form based on the following raw data.

Raw Data:
${JSON.stringify(rawData, null, 2)}

Instructions:
1. Maintain a professional, objective tone.
2. Identify and highlight material risks and significant events.
3. Ensure accuracy based on the provided data.
4. Output should be structured with relevant headers.

Output ONLY the drafted summary text.
`;

  try {

    const draftedForm = await callModel({ 
      messages: [{ role: "user", content: prompt }], 
      model: MODELS.GEMINI_1_5_PRO,
      temperature: 0.2
    });

    const content = draftedForm.content;

    if (account_id) {
        await recordLineage({
            target_id: `SEC-${formType}-${account_id}-${Date.now()}`,
            target_type: `SEC_${formType}`,
            sources: [{ type: 'account_data', id: account_id }],
            model: MODELS.GEMINI_1_5_PRO,
            user_id: user_id || 'system',
            tenant_id: tenant_id || 'default'
        });
    }

    return content;
  } catch (error) {
    console.error(`[compliance] Error drafting SEC ${formType}:`, error.message);
    throw new Error(`Failed to draft SEC ${formType} form.`);
  }
}
