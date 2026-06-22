// Quick connectivity + model check for SiliconFlow / DeepSeek.
// Usage:  npm run test:llm           (reads .env.local)
// Prints the first chunk of a streamed completion so you can confirm your key,
// base URL and model id all work before running the app.

const base = (process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
const model = process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V4-Pro";
const key = process.env.SILICONFLOW_API_KEY;

if (!key) {
  console.error("✗ SILICONFLOW_API_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

console.log(`→ endpoint: ${base}/chat/completions`);
console.log(`→ model:    ${model}\n`);

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    stream: false,
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with exactly: OK, SiliconFlow is reachable." }],
  }),
});

if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
console.log("✓ Success. Model replied:\n");
console.log(data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2));
