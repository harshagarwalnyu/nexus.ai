import AdmZip from "adm-zip";
import { callModel, MODELS } from "../ai.client.js";

export async function processDataRoomZip(buffer, jobId = Date.now().toString()) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const results = [];
    let context = "";

    for (const entry of entries) {
        if (entry.isDirectory) continue;
        const name = entry.entryName;
        const data = entry.getData().toString("utf8");
        if (name.match(/\.(txt|md|csv|json)$/i)) {
            context += `\nFILE: ${name}\n${data.slice(0, 3000)}`;
            const res = await analyzeArtifact(name, data);
            results.push({ file_name: name, ...res });
        }
    }

    const sim = await runCompetitorSimulation(context);
    return { processed_count: results.length, artifacts: results, competitor_simulation: sim, overall_risk: results.reduce((acc, r) => acc + (r.risk_score || 0.5), 0) / (results.length || 1) };
}

async function analyzeArtifact(name, content) {
    const prompt = `Analyze: ${name}. Content: ${content.slice(0, 5000)}. Return JSON: { "summary": "...", "red_flags": [], "anomalies_detected": [], "risk_score": 0.0, "priority": "low|medium|high" }`;
    const res = await callModel({ messages: [{ role: "user", content: prompt }], temperature: 0.1 });
    try { return JSON.parse(res.content.replace(/```json|```/g, "")); }
    catch { return { summary: "Err", red_flags: [], anomalies_detected: [], risk_score: 0.5, priority: "medium" }; }
}

async function runCompetitorSimulation(context) {
    const prompt = `Simulate response. Context: ${context.slice(0, 10000)}. Return JSON: { "simulated_competitor": "...", "attack_vector": "...", "impact_on_cac": "...", "impact_on_ltv": "...", "survival_probability": 0.0 }`;
    const res = await callModel({ messages: [{ role: "user", content: prompt }], temperature: 0.4 });
    try { return JSON.parse(res.content.replace(/```json|```/g, "")); }
    catch { return { simulated_competitor: "Incumbent", attack_vector: "Price", impact_on_cac: "+20%", impact_on_ltv: "-15%", survival_probability: 0.4 }; }
}
