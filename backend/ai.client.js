export const MODELS = {
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash'
};

const DEFAULT_MODEL = MODELS.GEMINI_1_5_PRO;

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callModel({ 
    messages, 
    system = undefined, 
    model = DEFAULT_MODEL, 
    max_tokens = undefined, 
    temperature = 0.3,
    retries = 3
}) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    let contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    const payload = {
        contents,
        systemInstruction: system ? { role: 'system', parts: [{ text: system }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: max_tokens }
    };

    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.status === 429 || res.status >= 500) {
                const text = await res.text();
                lastError = new Error(`Gemini API Error ${res.status}: ${text}`);
                if (i < retries) {
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    console.warn(`[ai-client] Retry ${i + 1}/${retries} after ${delay.toFixed(0)}ms due to ${res.status}`);
                    await wait(delay);
                    continue;
                }
            }

            if (!res.ok) throw new Error(`Gemini API Error ${res.status}: ${await res.text()}`);
            
            const data = await res.json();
            return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
        } catch (err) {
            lastError = err;
            if (i < retries) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`[ai-client] Retry ${i + 1}/${retries} after ${delay.toFixed(0)}ms due to ${err.message}`);
                await wait(delay);
                continue;
            }
        }
    }

    throw lastError;
}

export async function* streamModel({ messages, system, model = DEFAULT_MODEL, max_tokens, temperature }) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    let contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    const payload = {
        contents,
        systemInstruction: system ? { role: 'system', parts: [{ text: system }] } : undefined,
        generationConfig: { temperature: temperature ?? 0.3, maxOutputTokens: max_tokens }
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Gemini Stream Error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content) yield content;
                } catch {}
            }
        }
    }
}

export function handleAIError(err, context = "AI Service") {
    console.error(`[${context}] Error:`, err.message);
    return { error: err.message, status: 500 };
}
