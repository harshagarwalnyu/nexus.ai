export const createSSEStreamer = (res) => {
  return async (streamIterable) => {

    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
    }

    const writeSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const chunk of streamIterable) {
        if (chunk.event === "on_chat_model_stream") {
          const content = chunk.data?.chunk?.content;
          if (content && typeof content === "string") {
            writeSSE({ type: "content", delta: content });
          } else if (Array.isArray(content) && content[0]?.type === "tool_use") {
            writeSSE({ type: "tool_start", tool: content[0].name, input: content[0].input });
          }
        } else if (chunk.event === "on_tool_start") {
           writeSSE({ type: "tool_start", tool: chunk.name, input: chunk.data?.input });
        } else if (chunk.event === "on_tool_end") {
           writeSSE({ type: "tool_end", tool: chunk.name, result: "Success" });
        }
      }
      writeSSE("[DONE]");
    } catch (err) {
      console.error("[SSE Handler Error]", err);
      writeSSE({ type: "error", message: err.message });
    } finally {
      res.end();
    }
  };
};