import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE_URL = "https://poddleme.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    type SlugRow = { slug: string; updated_at: string };

    const [problemsRes, ideasRes, predictionsRes] = await Promise.all([
      supabase.from("problems").select("slug, updated_at").not("slug", "is", null).order("updated_at", { ascending: false }).limit(500),
      supabase.from("ideas").select("slug, updated_at").not("slug", "is", null).order("updated_at", { ascending: false }).limit(500),
      supabase.from("predictions").select("slug, updated_at").not("slug", "is", null).order("updated_at", { ascending: false }).limit(500),
    ]);

    const problems: SlugRow[] = (problemsRes.data || []).filter((r: SlugRow) => r.slug);
    const ideas: SlugRow[] = (ideasRes.data || []).filter((r: SlugRow) => r.slug);
    const predictions: SlugRow[] = (predictionsRes.data || []).filter((r: SlugRow) => r.slug);

    const now = new Date().toISOString().split("T")[0];

    const staticUrls = [
      { loc: `${BASE_URL}/`,                    changefreq: "daily",   priority: "1.0", lastmod: now },
      { loc: `${BASE_URL}/reasoning/forecasts`, changefreq: "daily",   priority: "0.9", lastmod: now },
      { loc: `${BASE_URL}/reasoning/ideas`,     changefreq: "daily",   priority: "0.9", lastmod: now },
      { loc: `${BASE_URL}/reasoning/problems`,  changefreq: "daily",   priority: "0.9", lastmod: now },
      { loc: `${BASE_URL}/#pricing`,            changefreq: "weekly",  priority: "0.8", lastmod: now },
      { loc: `${BASE_URL}/#agent-predictions`,  changefreq: "daily",   priority: "0.8", lastmod: now },
      { loc: `${BASE_URL}/#ai-feed`,            changefreq: "daily",   priority: "0.7", lastmod: now },
      { loc: `${BASE_URL}/#contact-us`,         changefreq: "monthly", priority: "0.4", lastmod: now },
      { loc: `${BASE_URL}/#privacy`,            changefreq: "monthly", priority: "0.3", lastmod: now },
      { loc: `${BASE_URL}/#terms`,              changefreq: "monthly", priority: "0.3", lastmod: now },
    ];

    const urlXml = (loc: string, lastmod: string, changefreq: string, priority: string) =>
      `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    const entries = [
      ...staticUrls.map(u => urlXml(u.loc, u.lastmod, u.changefreq, u.priority)),
      ...predictions.map((r: SlugRow) => urlXml(`${BASE_URL}/reasoning/forecasts/${r.slug}`, r.updated_at ? r.updated_at.split("T")[0] : now, "weekly", "0.8")),
      ...ideas.map((r: SlugRow) => urlXml(`${BASE_URL}/reasoning/ideas/${r.slug}`, r.updated_at ? r.updated_at.split("T")[0] : now, "weekly", "0.8")),
      ...problems.map((r: SlugRow) => urlXml(`${BASE_URL}/reasoning/problems/${r.slug}`, r.updated_at ? r.updated_at.split("T")[0] : now, "weekly", "0.8")),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
