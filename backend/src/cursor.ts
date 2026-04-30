import { Agent } from "@cursor/sdk";

const apiKey = process.env.CURSOR_API_KEY!;
const cwd = process.env.AGENT_CWD ?? "/tmp/specter-audit-cwd";

export async function runAgent(prompt: string): Promise<{ text: string; durationMs: number }> {
  const t0 = Date.now();
  const agent = await Agent.create({
    apiKey,
    model: { id: "composer-2" },
    local: { cwd },
  });
  try {
    const run = await agent.send(prompt);
    await run.wait();
    const turns = await run.conversation();
    let text = "";
    for (const turn of turns) {
      const t = turn as { type?: string; turn?: { steps?: Array<{ type?: string; message?: { text?: string } }> } };
      if (t.turn?.steps) {
        for (const step of t.turn.steps) {
          if (step.type === "assistantMessage" && step.message?.text) {
            text += step.message.text;
          }
        }
      }
    }
    return { text, durationMs: Date.now() - t0 };
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

export function extractJson<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\[{][\s\S]*?[\]}])\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]) as T; } catch {}
  }
  const start = Math.min(
    ...["{", "["].map((c) => {
      const i = text.indexOf(c);
      return i === -1 ? Infinity : i;
    })
  );
  if (start === Infinity) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  const end = text.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)) as T; } catch {}
  return null;
}
