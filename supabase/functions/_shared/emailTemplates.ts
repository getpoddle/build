/**
 * Shared HTML email template builder for Poddle transactional emails.
 * All templates use the same dark-themed base layout.
 */

export const APP_URL = "https://poddleme.com";

function emailShell(title: string, headerBand: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
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
            ${headerBand}
            <div style="padding:32px;">
              ${body}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="color:#475569;font-size:12px;margin:0;">
              &copy; 2026 Poddle, Inc. &mdash; <a href="${APP_URL}" style="color:#64748b;text-decoration:underline;">poddleme.com</a>
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

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:-0.1px;">${label} &rarr;</a>`;
}

function supportNote(): string {
  return `<p style="color:#475569;font-size:12px;margin:28px 0 0 0;line-height:1.6;">Questions? Reply to this email or visit <a href="${APP_URL}/#contact-us" style="color:#64748b;">our support page</a>.</p>`;
}

// ─── Welcome / Onboarding ─────────────────────────────────────────────────────

export function buildWelcomeEmail(firstName: string): string {
  const header = `<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Welcome to Poddle</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">You're in, ${firstName}. Let's make better decisions.</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 24px 0;">
      Hi ${firstName},
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 24px 0;">
      Welcome to Poddle &mdash; the decision intelligence platform where seven specialized AI agents challenge your thinking from every angle, and the War Room synthesizes the debate into a clear, defensible recommendation.
    </p>

    <p style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 14px 0;">Here's what Poddle does:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td style="padding:0 0 18px 0;">
        <p style="color:#60a5fa;font-size:14px;font-weight:700;margin:0 0 4px 0;">1. AI Collaboration</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          Submit any decision you're facing. Seven agents &mdash; Risk Analyst, Devil's Advocate, Financial Strategist, Market Analyst, Execution Lead, Innovation Scout, and People Advisor &mdash; respond simultaneously, each from a completely different perspective. Your team can join the conversation, challenge the agents, and upload supporting documents to ground the analysis in real data.
        </p>
      </td></tr>
      <tr><td style="padding:0 0 18px 0;">
        <p style="color:#60a5fa;font-size:14px;font-weight:700;margin:0 0 4px 0;">2. War Room</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          Once the agents have debated, the War Room reads every message and produces a strategic synthesis: consensus points, conflict zones, blind spots, cognitive bias flags, risk signals, a Decision Health Score, and prioritized action items.
        </p>
      </td></tr>
      <tr><td style="padding:0 0 0 0;">
        <p style="color:#60a5fa;font-size:14px;font-weight:700;margin:0 0 4px 0;">3. Board-Ready PDF</p>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          Export the full War Room synthesis into a structured PDF to share with your board, investors, or leadership team without disclosing your full workspace.
        </p>
      </td></tr>
    </table>

    <p style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 14px 0;">Your first 3 steps:</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr><td style="padding:0 0 12px 0;">
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          <strong style="color:#e2e8f0;">Complete your profile</strong> &mdash; add your name and domain expertise so agents can tailor their analysis.
        </p>
      </td></tr>
      <tr><td style="padding:0 0 12px 0;">
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          <strong style="color:#e2e8f0;">Create a workspace</strong> &mdash; name the decision you want to stress-test. This becomes the central topic for your AI Collaboration.
        </p>
      </td></tr>
      <tr><td style="padding:0 0 0 0;">
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          <strong style="color:#e2e8f0;">Brief your advisors</strong> &mdash; ask your first question. The agents will respond in three debate rounds, then run a War Room synthesis when you're ready.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;margin-bottom:28px;">
      <tr><td style="padding:16px 20px;">
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
          You get <strong style="color:#94a3b8;">one free workspace</strong> to try the full experience &mdash; no credit card required.
        </p>
      </td></tr>
    </table>

    ${ctaButton("Go to Poddle", APP_URL)}
    ${supportNote()}`;

  return emailShell(`Welcome to Poddle — here's how to get started`, header, body);
}

// ─── Email Confirmation (signup) ─────────────────────────────────────────────

export function buildConfirmationEmail(firstName: string, confirmUrl: string): string {
  const header = `<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Confirm your email</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Welcome to Poddle, ${firstName}. One click to go.</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 24px 0;">
      Hi ${firstName},
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
      You're almost in. Click the button below to confirm your email address and activate your Poddle account.
    </p>
    ${ctaButton("Confirm my email", confirmUrl)}
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:28px 0 0 0;">
      Or copy this link into your browser:<br/>
      <a href="${confirmUrl}" style="color:#64748b;word-break:break-all;">${confirmUrl}</a>
    </p>
    <p style="color:#475569;font-size:12px;line-height:1.6;margin:20px 0 0 0;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>`;

  return emailShell(`Confirm your email — Poddle`, header, body);
}

// ─── Invoice / Payment Confirmation ────────────────────────────────────────────

export function buildInvoiceEmail(
  firstName: string,
  planLabel: string,
  amountFormatted: string,
  periodEnd: string,
  invoiceUrl: string | null,
): string {
  const header = `<div style="background:linear-gradient(135deg,#064e3b,#059669);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Payment Confirmed</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Your payment was successful, ${firstName}</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 24px 0;">
      We received your payment of <strong style="color:#e2e8f0;">${amountFormatted}</strong> for your
      <strong style="color:#e2e8f0;">${planLabel} subscription</strong>.
      Your subscription is active through <strong style="color:#e2e8f0;">${periodEnd}</strong>.
    </p>
    ${invoiceUrl ? `<p style="margin:0 0 28px 0;">${ctaButton("Download Invoice", invoiceUrl)}</p>` : ""}
    ${ctaButton("Open Poddle", `${APP_URL}/#workspaces`)}
    ${supportNote()}`;

  return emailShell(`Payment confirmed — Poddle ${planLabel}`, header, body);
}

// ─── Payment Failed ─────────────────────────────────────────────────────────

export function buildPaymentFailedEmail(
  firstName: string,
  planLabel: string,
  amountFormatted: string,
  billingPortalUrl: string,
): string {
  const header = `<div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Action Required</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Payment failed for your ${planLabel} subscription</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 16px 0;">
      Hi ${firstName}, we were unable to process your payment of <strong style="color:#e2e8f0;">${amountFormatted}</strong>.
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
      Your workspace will remain accessible during a short grace period, but access may be interrupted if this is not resolved promptly.
      Please update your payment method to keep your workspace running.
    </p>
    <p style="margin:0 0 28px 0;">${ctaButton("Update Payment Method", billingPortalUrl)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;margin-bottom:28px;">
      <tr><td style="padding:16px 20px;">
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
          If you believe this is an error, reply to this email and we will help you resolve it right away.
        </p>
      </td></tr>
    </table>
    ${supportNote()}`;

  return emailShell(`Action required — payment failed`, header, body);
}

// ─── Upcoming Renewal Reminder ──────────────────────────────────────────────

export function buildRenewalReminderEmail(
  firstName: string,
  planLabel: string,
  amountFormatted: string,
  renewalDate: string,
  billingPortalUrl: string,
): string {
  const header = `<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Upcoming Renewal</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Your ${planLabel} subscription renews soon, ${firstName}</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 16px 0;">
      Just a heads-up — your <strong style="color:#e2e8f0;">${planLabel} subscription</strong> will automatically renew on
      <strong style="color:#e2e8f0;">${renewalDate}</strong> for <strong style="color:#e2e8f0;">${amountFormatted}</strong>.
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
      No action is needed if everything looks good. If you'd like to update your payment method, change your plan, or cancel before the renewal date, you can do so in the billing portal.
    </p>
    <p style="margin:0 0 28px 0;">${ctaButton("Manage Billing", billingPortalUrl)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;margin-bottom:28px;">
      <tr><td style="padding:16px 20px;">
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
          If you don't want to renew, cancel before <strong style="color:#94a3b8;">${renewalDate}</strong> to avoid being charged.
        </p>
      </td></tr>
    </table>
    ${supportNote()}`;

  return emailShell(`Your Poddle ${planLabel} subscription renews on ${renewalDate}`, header, body);
}

// ─── Subscription Cancelled ─────────────────────────────────────────────────

export function buildCancellationEmail(
  firstName: string,
  planLabel: string,
  workspaceName: string,
  accessUntil: string,
  reactivateUrl: string,
): string {
  const header = `<div style="background:linear-gradient(135deg,#1e293b,#334155);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Subscription Cancelled</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">Your ${planLabel} subscription has been cancelled</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 16px 0;">
      Hi ${firstName}, your <strong style="color:#e2e8f0;">${planLabel}</strong> subscription for
      <strong style="color:#e2e8f0;">${workspaceName}</strong> has been cancelled.
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
      You will retain full access until <strong style="color:#e2e8f0;">${accessUntil}</strong>, after which the workspace will revert to the free tier.
      Your data is safe &mdash; nothing is deleted. You can resubscribe at any time to restore full access immediately.
    </p>
    <p style="margin:0 0 28px 0;">${ctaButton("Reactivate Subscription", reactivateUrl)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:12px;border:1px solid #1e293b;margin-bottom:28px;">
      <tr><td style="padding:16px 20px;">
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
          We'd love to know why you cancelled. Hit reply &mdash; your feedback genuinely shapes where we go next.
        </p>
      </td></tr>
    </table>
    ${supportNote()}`;

  return emailShell(`Your Poddle ${planLabel} subscription has been cancelled`, header, body);
}

// ─── Workspace Invite Accepted ──────────────────────────────────────────────

export function buildInviteAcceptedEmail(
  inviterName: string,
  accepterName: string,
  workspaceName: string,
): string {
  const header = `<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 32px 28px;">
    <p style="color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Invite Accepted</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0;line-height:1.2;">${accepterName} joined your workspace</h1>
  </div>`;

  const body = `
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 16px 0;">
      Hi ${inviterName},
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
      <strong style="color:#e2e8f0;">${accepterName}</strong> has accepted your invitation and joined
      <strong style="color:#e2e8f0;">${workspaceName}</strong>. They can now participate in AI Collaboration sessions and view the War Room synthesis.
    </p>
    ${ctaButton("Open Workspace", `${APP_URL}/#workspaces`)}
    ${supportNote()}`;

  return emailShell(`${accepterName} accepted your workspace invitation`, header, body);
}
