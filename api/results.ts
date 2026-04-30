import type { VercelRequest, VercelResponse } from "@vercel/node";

const analysisCache = new Map<string, unknown>();

export { analysisCache };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing analysis ID" });
  }

  const result = analysisCache.get(id);
  if (!result) {
    return res.status(404).json({ error: "Analysis not found" });
  }

  return res.status(200).json(result);
}
