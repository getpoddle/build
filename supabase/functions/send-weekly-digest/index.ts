import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const POSTHOG_KEY = Deno.env.get("POSTHOG_KEY");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") || "https://eu.i.posthog.com";

function phCaptureServer(event: string, distinctId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  try {
    const promise = fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...(properties ?? {}), source: "edge_function" },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      (EdgeRuntime as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(promise);
    }
  } catch {
    /* no-op */
  }
}

const APP_URL = Deno.env.get("APP_URL") || "https://poddleme.com";

interface WeeklyArticle {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  reading_time_minutes: number;
}

function emailBase(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Poddle</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
        <tr>
          <td style="padding-bottom:32px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#1e293b;border-radius:10px;padding:10px 16px;">
                  <span style="color:#f8fafc;font-size:16px;font-weight:700;letter-spacing:-0.3px;">Poddle</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0 0 8px 0;">
              You're receiving this because you have email notifications enabled on Poddle.
            </p>
            <p style="color:#475569;font-size:12px;margin:0;">
              <a href="${APP_URL}/profile" style="color:#64748b;text-decoration:underline;">Manage notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildEditorialEmail(recipientName: string, article: WeeklyArticle): string {
  const articleUrl = `${APP_URL}/blog/${article.slug}`;

  // Extract the first <h2> as the lesson heading and first <p> as the hook
  const hookMatch = article.content.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const hook = hookMatch ? hookMatch[1].replace(/<[^>]*>/g, "") : article.excerpt;

  // Extract the persona spotlight quote
  const quoteMatch = article.content.match(/font-style:italic[^>]*>([\s\S]*?)<\/p>/);
  const quote = quoteMatch ? quoteMatch[1].replace(/<[^>]*>/g, "") : "";

  // Extract the "Try this" section
  const tryThisMatch = article.content.match(/<em[^>]*>([\s\S]*?)<\/em>/);
  const tryThis = tryThisMatch ? tryThisMatch[1].replace(/<[^>]*>/g, "") : "";

  return emailBase(`
    <div style="padding:32px;">
      <p style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">This Week on Poddle</p>
      <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">${article.title}</h1>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px 0;">${hook}</p>

      <div style="background:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px 24px;margin-bottom:28px;">
        <p style="color:#f8fafc;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 12px 0;">The Decision-Intelligence Lesson</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">${article.excerpt}</p>
      </div>

      ${quote ? `
      <div style="background:#0f172a;border-radius:12px;border-left:4px solid #2563eb;padding:20px 24px;margin-bottom:28px;">
        <p style="font-style:italic;color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 8px 0;">"${quote}"</p>
        <p style="color:#64748b;font-size:13px;margin:0;">— A Poddle user</p>
      </div>
      ` : ""}

      ${tryThis ? `
      <div style="background:#0f172a;border-radius:12px;border:1px solid #334155;padding:20px 24px;margin-bottom:28px;">
        <p style="color:#f8fafc;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 12px 0;">Try This</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;font-style:italic;">${tryThis}</p>
      </div>
      ` : ""}

      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 24px 0;">Read the full article below, or open it on Poddle.</p>

      <a href="${articleUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">Read the full article</a>
    </div>
  `);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendKey: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Poddle <notifications@poddleme.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status} for ${to}: ${err}`);
  }

  const result = await res.json();
  console.log(`Sent digest: ${result.id} → ${to}`);
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return ((week - 1) % 12) + 1;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Determine current week number (1-12, cycling)
    const weekNumber = getCurrentWeekNumber();
    console.log(`Weekly digest: looking up article for week ${weekNumber}`);

    // Fetch the article for this week
    const { data: article, error: articleError } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, content, reading_time_minutes")
      .eq("week_number", weekNumber)
      .eq("is_published", true)
      .single();

    if (articleError || !article) {
      throw new Error(`Failed to fetch article for week ${weekNumber}: ${articleError?.message || "not found"}`);
    }

    console.log(`Weekly article: ${article.title} (slug: ${article.slug})`);

    // Fetch all real users with email notifications enabled
    const { data: realUsers, error: recipientsError } = await supabase.rpc("get_digest_recipients");
    if (recipientsError) {
      throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);
    }

    const subject = `${article.title} — This Week on Poddle`;
    const results: { email: string; status: string; error?: string }[] = [];

    for (const user of realUsers) {
      try {
        const name = user.first_name || user.full_name?.split(" ")[0] || "there";
        const html = buildEditorialEmail(name, article as WeeklyArticle);

        await sendEmail(user.email, subject, html, RESEND_API_KEY);
        results.push({ email: user.email, status: "sent" });
        phCaptureServer("weekly_article_sent", user.user_id ?? user.email, {
          article_slug: article.slug,
          article_title: article.title,
          week_number: weekNumber,
        });

        // Small delay to avoid Resend rate limits
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed for ${user.email}:`, msg);
        results.push({ email: user.email, status: "failed", error: msg });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.log(`Weekly digest complete: ${sent} sent, ${failed} failed (article: ${article.slug})`);
    phCaptureServer("weekly_digest_run_completed", "system", {
      sent,
      failed,
      article_slug: article.slug,
      article_title: article.title,
      week_number: weekNumber,
    });

    return new Response(
      JSON.stringify({ success: true, sent, failed, article: article.slug, week_number: weekNumber, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-weekly-digest error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
