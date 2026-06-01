import type { Context } from "https://edge.netlify.com";

const BASE_URL = "https://poddleme.com";
const SUPABASE_URL = "https://bggdthmhcanzzuqkztdo.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ2R0aG1oY2Fuenp1cWt6dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE3NTgsImV4cCI6MjA4NTI2Nzc1OH0.uocKHVkPNwT1NzuKO6fsC0G5lpWt5uVzPyGCD5X_DR0";

const BOT_PATTERNS = [
  "googlebot", "google-inspectiontool", "bingbot", "slurp", "duckduckbot",
  "baiduspider", "yandexbot", "facebot", "facebookexternalhit", "twitterbot",
  "linkedinbot", "whatsapp", "telegrambot", "discordbot", "applebot",
  "semrushbot", "ahrefsbot", "mj12bot", "petalbot",
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(p => ua.includes(p));
}

type CategoryKey = "ideas" | "problems" | "forecasts";

const CATEGORY_META: Record<CategoryKey, { title: string; description: string; keywords: string }> = {
  ideas: {
    title: "AI-Analyzed Business Ideas & Innovation Strategies | Poddle",
    description: "Explore AI-analyzed business ideas and innovation strategies with step-by-step execution plans. Pressure-tested by multiple AI agents on Poddle.",
    keywords: "business ideas, innovation strategy, AI analysis, startup ideas, execution plans, Poddle ideas",
  },
  problems: {
    title: "Critical Business Problems & Strategic Challenges | Poddle",
    description: "Discover critical business problems and strategic challenges analyzed by AI agents. Each problem is mapped with solution steps and open for expert debate on Poddle.",
    keywords: "business problems, strategic challenges, AI analysis, problem-solving, Poddle problems",
  },
  forecasts: {
    title: "AI Business Forecasts & Strategic Predictions | Poddle",
    description: "Browse AI agent forecasts on business strategy, technology, and market shifts. Each prediction is pressure-tested by multiple AI agents and open for expert challenge.",
    keywords: "business forecasts, strategic predictions, AI analysis, market outlook, Poddle forecasts",
  },
};

const TABLE_MAP: Record<CategoryKey, string> = {
  ideas: "ideas",
  problems: "problems",
  forecasts: "predictions",
};

interface EntityRow {
  content: string;
  domain: string;
  created_at: string;
  slug: string;
  confidence?: number;
  feasibility_score?: number;
  impact_score?: number;
  horizon_years?: number;
}

async function fetchEntity(table: string, slug: string): Promise<EntityRow | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=content,domain,created_at,slug,confidence,feasibility_score,impact_score,horizon_years&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    const data = await res.json() as EntityRow[];
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

function buildEntityMeta(cat: CategoryKey, entity: EntityRow): { title: string; description: string; keywords: string } {
  const snippet = entity.content.length > 140
    ? entity.content.slice(0, 140).trimEnd() + "…"
    : entity.content;
  const domain = entity.domain ? entity.domain.replace(/_/g, " ") : "strategy";
  const titles: Record<CategoryKey, string> = {
    forecasts: "forecast",
    ideas: "idea",
    problems: "problem",
  };
  const typeLabel = titles[cat];
  const title = `${entity.content.length > 80 ? entity.content.slice(0, 80) + "…" : entity.content} | Poddle`;
  const description = `AI-analyzed ${typeLabel} in ${domain}: ${snippet}. Pressure-tested by AI agents on Poddle.`;
  const keywords = `${domain}, AI analysis, ${typeLabel}, Poddle reasoning`;
  return { title, description, keywords };
}

function injectMeta(html: string, meta: {
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
}): string {
  // Replace title
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`
  );
  // Replace canonical
  html = html.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${meta.canonical}" />`
  );
  // Replace description
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeHtml(meta.description)}$2`
  );
  // Replace keywords
  html = html.replace(
    /(<meta name="keywords" content=")[^"]*(")/,
    `$1${escapeHtml(meta.keywords)}$2`
  );
  // Replace og:url
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${meta.ogUrl}$2`
  );
  // Replace og:title
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeHtml(meta.ogTitle)}$2`
  );
  // Replace og:description
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeHtml(meta.ogDescription)}$2`
  );
  // Replace twitter:url
  html = html.replace(
    /(<meta name="twitter:url" content=")[^"]*(")/,
    `$1${meta.ogUrl}$2`
  );
  // Replace twitter:title
  html = html.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeHtml(meta.ogTitle)}$2`
  );
  // Replace twitter:description
  html = html.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeHtml(meta.ogDescription)}$2`
  );
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(request: Request, context: Context) {
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);
  const path = url.pathname;

  // Only intercept /reasoning/ paths
  if (!path.startsWith("/reasoning/")) {
    return context.next();
  }

  // Only inject for bots — real users get the normal SPA
  if (!isBot(ua)) {
    return context.next();
  }

  const parts = path.split("/").filter(Boolean); // ['reasoning', 'ideas', 'slug?']
  const catSeg = parts[1] as CategoryKey;

  if (!["ideas", "problems", "forecasts"].includes(catSeg)) {
    return context.next();
  }

  // Fetch the base HTML
  const response = await context.next();
  const html = await response.text();
  const canonicalUrl = `${BASE_URL}${path}`;

  let injected: string;

  const slugSeg = parts[2];
  if (slugSeg) {
    // Entity page — fetch from DB
    const table = TABLE_MAP[catSeg];
    const entity = await fetchEntity(table, slugSeg);

    if (!entity) {
      return new Response(html, { status: 404, headers: response.headers });
    }

    const { title, description, keywords } = buildEntityMeta(catSeg, entity);
    injected = injectMeta(html, {
      title,
      description,
      keywords,
      canonical: canonicalUrl,
      ogTitle: title,
      ogDescription: description,
      ogUrl: canonicalUrl,
    });
  } else {
    // Category page
    const catMeta = CATEGORY_META[catSeg];
    injected = injectMeta(html, {
      title: catMeta.title,
      description: catMeta.description,
      keywords: catMeta.keywords,
      canonical: canonicalUrl,
      ogTitle: catMeta.title,
      ogDescription: catMeta.description,
      ogUrl: canonicalUrl,
    });
  }

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
}

export const config = { path: "/reasoning/*" };
