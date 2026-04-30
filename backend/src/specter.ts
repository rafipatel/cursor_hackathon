const apiKey = process.env.SPECTER_API_KEY!;
const SPECTER_URL = "https://app.tryspecter.com/api/v1/companies";

export interface SpecterSnapshot {
  id?: string;
  organization_name?: string;
  tagline?: string;
  description?: string;
  traction_highlights?: string;
  business_models?: string[];
  customer_focus?: string;
  tags?: string[];
  last_updated?: string;
  rank?: number;
  domain?: string;
  matched_on: "domain" | "name";
}

export interface SpecterImpact {
  score: number;
  band: "high" | "medium" | "low";
  signal: string;
  factors: string[];
}

export function computeImpact(snap: SpecterSnapshot | null | undefined): SpecterImpact {
  if (!snap) {
    return { score: 0, band: "low", signal: "no Specter intel", factors: ["no_intel"] };
  }
  let score = 30;
  const factors: string[] = [];
  const r = snap.rank;
  if (typeof r === "number" && r > 0) {
    if (r <= 100_000) { score += 50; factors.push(`rank_top_100k`); }
    else if (r <= 500_000) { score += 30; factors.push(`rank_top_500k`); }
    else if (r <= 2_000_000) { score += 10; factors.push(`rank_top_2m`); }
  }
  if (snap.traction_highlights && snap.traction_highlights.trim().length > 0) {
    score += 10; factors.push("has_traction");
  }
  if (snap.business_models?.some((m) => /financial|saas|professional/i.test(m))) {
    score += 5; factors.push("relevant_business_model");
  }
  if (snap.last_updated) {
    const ageDays = Math.max(0, (Date.now() - new Date(snap.last_updated).getTime()) / 86_400_000);
    if (Number.isFinite(ageDays) && ageDays < 120) { score += 5; factors.push("recent_intel"); }
  }
  if (score > 100) score = 100;
  const band: SpecterImpact["band"] = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  const parts: string[] = [];
  if (snap.organization_name) parts.push(snap.organization_name);
  if (snap.business_models?.length) parts.push(snap.business_models.slice(0, 2).join("/"));
  if (snap.traction_highlights) parts.push(snap.traction_highlights);
  const signal = parts.filter(Boolean).join(" — ") || "specter-matched firm";
  return { score, band, signal, factors };
}

const cache = new Map<string, SpecterSnapshot | null>();

export async function lookupCompany(input: { domain?: string; name?: string }): Promise<SpecterSnapshot | null> {
  const key = (input.domain ?? input.name ?? "").toLowerCase().trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  const body: Record<string, string> = {};
  let matched_on: "domain" | "name" = "name";
  if (input.domain) {
    body.domain = input.domain;
    matched_on = "domain";
  } else if (input.name) {
    body.name = input.name;
  } else {
    cache.set(key, null);
    return null;
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(SPECTER_URL, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`specter ${matched_on}=${key} → ${res.status}`);
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`specter_unavailable:${res.status}`);
      }
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, null);
      return null;
    }
    const c = data[0];
    const snap: SpecterSnapshot = {
      id: c.id as string,
      organization_name: c.organization_name as string,
      tagline: c.tagline as string,
      description: typeof c.description === "string" ? (c.description as string).slice(0, 600) : undefined,
      traction_highlights: c.traction_highlights as string,
      business_models: c.business_models as string[],
      customer_focus: c.customer_focus as string,
      tags: Array.isArray(c.tags) ? (c.tags as string[]).slice(0, 8) : undefined,
      last_updated: c.last_updated as string,
      rank: c.organization_rank as number,
      domain: typeof c.domain === "string" ? (c.domain as string) : (input.domain ?? undefined),
      matched_on,
    };
    cache.set(key, snap);
    return snap;
  } catch (e) {
    console.warn(`specter ${matched_on}=${key} threw`, (e as Error).message);
    cache.set(key, null);
    return null;
  } finally {
    clearTimeout(to);
  }
}
