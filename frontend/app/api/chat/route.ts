export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.json();
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

    const backendRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.BETTER_AUTH_SECRET || "changeme_in_prod"
        },
        body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
        const errText = await backendRes.text();
        return new Response(JSON.stringify({ error: errText }), {
            status: backendRes.status,
            headers: { "Content-Type": "application/json" }
        });
    }

    const stream = new ReadableStream({
        async start(controller) {
            if (!backendRes.body) {
                controller.close();
                return;
            }
            const reader = backendRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.type === "thinking_start" || parsed.type === "thinking") continue;

                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            controller.enqueue(new TextEncoder().encode(content));
                        }
                    } catch {

                    }
                }
            }
            controller.close();
        },
        cancel() {

        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    });
}