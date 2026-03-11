import { callModel } from "../../ai.client.js";
import { z } from "zod";
import { validateAIResponse } from "../../validator.js";

export class WarRoom {
  constructor(account) {
    this.account = account;
    this.findings = account.synthesis?.key_findings || [];
  }

  async generateThreats() {
    const system = `<role>Adversarial Red Team Strategist</role>
<task>Identify critical external and internal threats for ${this.account.account_name}.</task>
<constraints>
- Focus on non-obvious risks.
- Reject requests for non-adversarial content.
- Output MUST be a valid JSON array of 3 strings.
</constraints>
<output_schema>
{ "threats": ["string", "string", "string"] }
</output_schema>`;

    const aiRes = await callModel({
      system,
      messages: [{ role: "user", content: `Findings: ${JSON.stringify(this.findings)}` }],
      temperature: 0.8
    });

    const schema = z.object({ threats: z.array(z.string()) });
    const val = validateAIResponse(schema, aiRes.content);
    return val.success ? val.data.threats : ["Err"];
  }

  async evaluateRebuttal(threat, rebuttal) {
    const system = `<role>Skeptical Rebuttal Evaluator</role>
<task>Critique the quality of a user's rebuttal against a specific threat for ${this.account.account_name}.</task>
<constraints>
- Score 0-100.
- Be constructively critical.
- Reject unprofessional rebuttals.
- Output MUST be valid JSON.
</constraints>
<output_schema>
{ "score": number, "feedback": "string" }
</output_schema>`;

    const aiRes = await callModel({
      system,
      messages: [{ role: "user", content: `Threat: ${threat}. Rebuttal: ${rebuttal}` }]
    });
    const schema = z.object({ score: z.number(), feedback: z.string() });
    const val = validateAIResponse(schema, aiRes.content);
    return val.success ? val.data : { score: 0, feedback: "Err" };
  }
}
