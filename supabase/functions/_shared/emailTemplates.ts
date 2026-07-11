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
