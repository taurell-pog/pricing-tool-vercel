// Vercel serverless function — Anthropic API proxy.
// Runs in Node.js 20 runtime. Free tier function timeout: 5 minutes (Hobby plan).
// Streams from Anthropic, accumulates the LAST text block, returns regular JSON.
// No browser-side SSE parsing needed.

export const config = {
  maxDuration: 300, // 5 minutes — covers even worst-case Sonnet + 10x web_search
};

export default async function handler(req, res) {
  // CORS (in case of local dev across ports)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method Not Allowed" } });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY not configured" } });
  }

  try {
    const body = req.body;
    const upstreamBody = { ...body, stream: true };

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05,prompt-caching-2024-07-31",
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      try {
        const errJson = JSON.parse(errText);
        return res.status(upstream.status).json(errJson);
      } catch {
        return res.status(upstream.status).json({ error: { message: errText } });
      }
    }

    // Read SSE, accumulate text, return LAST text block (post-tool-use answer).
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentBlock = "";
    let lastBlock = "";
    let stopReason = null;
    let usage = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "content_block_start" && ev.content_block?.type === "text") {
            currentBlock = "";
          } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            currentBlock += ev.delta.text;
          } else if (ev.type === "content_block_stop") {
            if (currentBlock) lastBlock = currentBlock;
            currentBlock = "";
          } else if (ev.type === "message_delta" && ev.delta) {
            if (ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
            if (ev.usage) usage = ev.usage;
          }
        } catch {/* ignore malformed lines */}
      }
    }
    if (currentBlock && !lastBlock) lastBlock = currentBlock;

    return res.status(200).json({
      content: [{ type: "text", text: lastBlock }],
      stop_reason: stopReason,
      usage,
    });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
