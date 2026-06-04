// Generates the Poddle System Architecture & Blueprint as a Word-compatible
// HTML document (.doc) and triggers a browser download.

export function downloadArchitectureDoc() {
  const DOC_DATE = 'June 2026';
  const VERSION  = '2.0';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Poddle System Architecture &amp; Blueprint</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  /* Base */
  body {
    font-family: "Calibri", "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    line-height: 1.55;
    margin: 0;
    padding: 0;
  }
  .page {
    width: 21cm;
    min-height: 29.7cm;
    margin: 0 auto;
    padding: 2.2cm 2.4cm 1.8cm 2.4cm;
    box-sizing: border-box;
  }
  @media print {
    .page { margin: 0; padding: 0; width: 100%; }
    @page { margin: 2.2cm 2.4cm 1.8cm 2.4cm; size: A4; }
  }

  /* Cover */
  .cover-bar {
    background: #1e3a5f;
    height: 6px;
    border-radius: 3px;
    margin-bottom: 40px;
  }
  .cover-badge {
    display: inline-block;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 3px 10px;
    border-radius: 20px;
    margin-bottom: 18px;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 8px 0;
  }
  .cover-subtitle {
    font-size: 13pt;
    color: #475569;
    margin: 0 0 36px 0;
    font-weight: 400;
  }
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 40px;
    font-size: 9.5pt;
  }
  .meta-table td {
    padding: 7px 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  .meta-table td:first-child {
    font-weight: 700;
    color: #64748b;
    width: 38%;
    text-transform: uppercase;
    font-size: 8pt;
    letter-spacing: 0.06em;
  }
  .meta-table td:last-child {
    color: #1e293b;
    font-weight: 600;
  }
  .cover-bottom-bar {
    background: #0f172a;
    color: #94a3b8;
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 8pt;
    display: flex;
    justify-content: space-between;
  }

  /* Headings */
  h1 {
    font-size: 20pt;
    font-weight: 900;
    color: #0f172a;
    margin: 32px 0 14px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #1e3a5f;
    page-break-after: avoid;
  }
  h2 {
    font-size: 13pt;
    font-weight: 800;
    color: #1e3a5f;
    margin: 24px 0 10px 0;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #334155;
    margin: 18px 0 8px 0;
    page-break-after: avoid;
  }

  /* Body text */
  p {
    margin: 0 0 10px 0;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #334155;
  }

  /* Tables */
  table.data {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  table.data th {
    background: #0f172a;
    color: #f1f5f9;
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 7px 10px;
    text-align: left;
    border: 1px solid #1e293b;
  }
  table.data td {
    padding: 7px 10px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    line-height: 1.5;
    color: #1e293b;
  }
  table.data tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Section callouts */
  .callout {
    background: #f0f7ff;
    border-left: 4px solid #2563eb;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 14px 0;
    font-size: 10pt;
    color: #1e3a5f;
    page-break-inside: avoid;
  }
  .callout-warn {
    background: #fffbeb;
    border-left-color: #f59e0b;
    color: #78350f;
  }
  .callout-danger {
    background: #fef2f2;
    border-left-color: #dc2626;
    color: #7f1d1d;
  }
  .callout-success {
    background: #f0fdf4;
    border-left-color: #16a34a;
    color: #14532d;
  }
  .callout strong { display: block; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }

  /* Code / mono */
  code {
    font-family: "Consolas", "Courier New", monospace;
    font-size: 9pt;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 1px 5px;
    border-radius: 4px;
    color: #0f172a;
  }
  pre {
    font-family: "Consolas", "Courier New", monospace;
    font-size: 8.5pt;
    background: #0f172a;
    color: #e2e8f0;
    padding: 14px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 10px 0 18px 0;
    line-height: 1.6;
    page-break-inside: avoid;
  }

  /* Lists */
  ul, ol {
    margin: 6px 0 14px 0;
    padding-left: 22px;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #334155;
  }
  li { margin-bottom: 4px; }

  /* Risk badge colours */
  .badge {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .badge-blue   { background: #eff6ff; color: #1d4ed8; }
  .badge-green  { background: #f0fdf4; color: #15803d; }
  .badge-amber  { background: #fffbeb; color: #b45309; }
  .badge-red    { background: #fef2f2; color: #b91c1c; }
  .badge-slate  { background: #f8fafc; color: #475569; }

  /* TOC */
  .toc-item {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    padding: 4px 0;
    border-bottom: 1px dotted #e2e8f0;
    color: #334155;
  }
  .toc-item .num { color: #2563eb; font-weight: 700; min-width: 28px; }
  .toc-item .dots { flex: 1; }

  /* Section number pill */
  .sec-pill {
    display: inline-block;
    background: #1e3a5f;
    color: #fff;
    font-size: 8pt;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 20px;
    margin-right: 8px;
    vertical-align: middle;
  }

  /* Footer */
  .doc-footer {
    margin-top: 48px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  /* Page break */
  .page-break { page-break-before: always; }
</style>
</head>
<body>
<div class="page">

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- COVER PAGE                                                               -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="cover-bar"></div>

<div class="cover-badge">Internal Confidential</div>

<h1 class="cover-title" style="font-size:32pt;border:none;padding:0;margin-bottom:6px;">
  Poddle System Architecture &amp; Blueprint
</h1>
<p class="cover-subtitle">Technical Due Diligence Document</p>

<table class="meta-table">
  <tr><td>Document Title</td><td>Poddle System Architecture &amp; Blueprint</td></tr>
  <tr><td>Document Type</td><td>Technical Due Diligence — Full Stack Architecture</td></tr>
  <tr><td>Version</td><td>${VERSION}</td></tr>
  <tr><td>Classification</td><td>Internal — Confidential</td></tr>
  <tr><td>Platform</td><td>Web (SPA) / iOS / Android (Capacitor) / Chrome Extension</td></tr>
  <tr><td>Primary Domain</td><td>poddleme.com</td></tr>
  <tr><td>Prepared</td><td>${DOC_DATE}</td></tr>
  <tr><td>Scope</td><td>Frontend, Backend, AI Pipeline, Data Layer, Infrastructure, Security, Integrations</td></tr>
</table>

<div class="cover-bottom-bar">
  <span>Poddle, Inc. &mdash; AI-Powered Decision Intelligence</span>
  <span>poddleme.com &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; ${DOC_DATE}</span>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- TABLE OF CONTENTS                                                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1>Table of Contents</h1>

${[
  '1.  Executive Summary',
  '2.  Technology Stack Overview',
  '3.  Frontend Architecture',
  '4.  Routing &amp; Navigation Architecture',
  '5.  Authentication &amp; Session Management',
  '6.  Database Architecture',
  '7.  AI Agent System',
  '8.  Edge Function Architecture',
  '9.  Real-Time Infrastructure',
  '10. Workspace System Architecture',
  '11. Subscription &amp; Billing Architecture',
  '12. Notification &amp; Email Architecture',
  '13. Chrome Extension Architecture',
  '14. Mobile Application Architecture',
  '15. Progressive Web App (PWA)',
  '16. SEO &amp; Crawler Infrastructure',
  '17. Analytics &amp; Observability',
  '18. Security Architecture',
  '19. Deployment &amp; CI/CD',
  '20. External Service Dependencies',
  '21. Code Quality &amp; Build Configuration',
  '22. Architectural Risks &amp; Observations',
].map((item, i) => `<div class="toc-item"><span class="num">${i + 1 < 10 ? '0' + (i + 1) : (i + 1)}.</span><span>${item.replace(/^\d+\.\s+/, '')}</span></div>`).join('\n')}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 1 — EXECUTIVE SUMMARY                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">1</span> Executive Summary</h1>

<p>
  Poddle is a decision intelligence platform that combines a public AI Reasoning Graph, private encrypted team
  Workspaces, and a browser extension (Poddle Lens). The platform is built as a React 18 single-page application
  served via Netlify, backed entirely by Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions).
  AI capabilities are powered exclusively by OpenAI (GPT-4o-mini, Whisper). Stripe handles subscription billing.
  Resend handles transactional email. PostHog provides product analytics.
</p>

<p>The platform has four primary surfaces:</p>
<ul>
  <li><strong>Web Application</strong> at poddleme.com — the main SPA</li>
  <li><strong>Chrome Extension (Poddle Lens)</strong> — side-panel browser extension for on-page AI analysis</li>
  <li><strong>iOS / Android app</strong> — Capacitor-wrapped WebView of the same SPA</li>
  <li><strong>PWA</strong> — installable from the browser with full manifest and icon support</li>
</ul>

<p>
  The AI system is built around a five-agent panel (The Skeptic, Risk Analyst, The Optimist, Data Detective,
  The Pragmatist) deployed across public question-answering, workspace collaboration, and autonomous content
  generation. All reasoning is structured into a three-tier entity graph: Problems &rarr; Ideas &rarr; Predictions,
  with relationship links, consensus verdicts, and calibration tracking.
</p>

<div class="callout callout-success">
  <strong>Architecture Principle</strong>
  Clean separation of concerns: the frontend is a thin React SPA with no business logic; all server-side
  processing runs in Supabase Edge Functions (Deno). There is no custom API server, no Kubernetes, no
  separate microservices layer.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 2 — TECHNOLOGY STACK                                            -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">2</span> Technology Stack Overview</h1>

<h2>Frontend</h2>
<table class="data">
  <tr><th>Concern</th><th>Technology</th><th>Version</th></tr>
  <tr><td>UI Framework</td><td>React</td><td>18.3.1</td></tr>
  <tr><td>Language</td><td>TypeScript</td><td>5.5.3</td></tr>
  <tr><td>Build Tool</td><td>Vite</td><td>5.4.2</td></tr>
  <tr><td>Styling</td><td>Tailwind CSS</td><td>3.4.1</td></tr>
  <tr><td>Icons</td><td>Lucide React</td><td>0.344.0</td></tr>
  <tr><td>PostCSS / Autoprefixer</td><td>PostCSS + Autoprefixer</td><td>8.4.35 / 10.4.18</td></tr>
  <tr><td>Analytics</td><td>PostHog JS</td><td>1.372.3</td></tr>
</table>

<h2>Backend / Infrastructure</h2>
<table class="data">
  <tr><th>Concern</th><th>Technology</th><th>Notes</th></tr>
  <tr><td>Database</td><td>Supabase (PostgreSQL)</td><td>RLS enabled on all tables</td></tr>
  <tr><td>Auth</td><td>Supabase Auth</td><td>Email/password + Google OAuth</td></tr>
  <tr><td>Realtime</td><td>Supabase Realtime</td><td>WebSocket channels; 20-channel cap</td></tr>
  <tr><td>Storage</td><td>Supabase Storage</td><td>Profile pictures, marketplace assets</td></tr>
  <tr><td>Edge Functions</td><td>Supabase Edge Functions</td><td>Deno runtime; 26 functions deployed</td></tr>
  <tr><td>Hosting</td><td>Netlify</td><td>CDN + Netlify Edge Functions for SEO</td></tr>
  <tr><td>Email</td><td>Resend</td><td>notifications@poddleme.com</td></tr>
</table>

<h2>AI / ML</h2>
<table class="data">
  <tr><th>Concern</th><th>Provider</th><th>Model</th></tr>
  <tr><td>Agent reasoning, chat &amp; synthesis</td><td>OpenAI</td><td>gpt-4o-mini</td></tr>
  <tr><td>Voice transcription</td><td>OpenAI Whisper</td><td>whisper-1</td></tr>
  <tr><td>Transcript cleanup</td><td>OpenAI</td><td>gpt-4o-mini</td></tr>
</table>

<h2>Payments &amp; Analytics</h2>
<table class="data">
  <tr><th>Service</th><th>Provider</th><th>Usage</th></tr>
  <tr><td>Subscription billing</td><td>Stripe</td><td>Checkout, webhooks, billing portal</td></tr>
  <tr><td>Product analytics</td><td>PostHog</td><td>EU region (eu.i.posthog.com)</td></tr>
</table>

<h2>Mobile &amp; Extension</h2>
<table class="data">
  <tr><th>Platform</th><th>Technology</th><th>Version</th></tr>
  <tr><td>iOS / Android</td><td>Capacitor</td><td>8.x</td></tr>
  <tr><td>Chrome Extension</td><td>Chrome Manifest V3</td><td>v1.0.2</td></tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 3 — FRONTEND ARCHITECTURE                                       -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">3</span> Frontend Architecture</h1>

<h2>Application Entry Point</h2>
<p>
  The application boots from <code>src/main.tsx</code>, rendering <code>&lt;App /&gt;</code> into <code>#root</code>.
  <code>AuthContext</code> and <code>ThemeContext</code> wrap the application globally.
</p>

<h2>Component Hierarchy</h2>
<pre>App
├── AuthContext.Provider
│   └── ThemeContext.Provider
│       ├── Navigation
│       ├── [Route Component]
│       └── Toast / ErrorBoundary</pre>

<h2>State Management</h2>
<p>
  No global state library is used (no Redux, Zustand, or MobX). State is managed through React
  <code>useState</code> / <code>useReducer</code> in components, <code>useContext</code> for cross-cutting
  concerns, <code>sessionStorage</code> for page persistence, <code>localStorage</code> for user preferences,
  and Supabase Realtime subscriptions for live data.
</p>

<h2>Code Splitting Strategy</h2>
<p>Vite is configured with manual chunk splitting to optimise initial load time:</p>
<table class="data">
  <tr><th>Chunk Name</th><th>Contents</th></tr>
  <tr><td><code>vendor</code></td><td>react, react-dom</td></tr>
  <tr><td><code>supabase</code></td><td>@supabase/supabase-js</td></tr>
  <tr><td><code>icons</code></td><td>lucide-react</td></tr>
  <tr><td><code>posthog</code></td><td>posthog-js</td></tr>
  <tr><td><code>admin</code></td><td>Admin pages, AdminPanel, AdminDashboard, AdminAuth, DomainManagement</td></tr>
  <tr><td><code>workspaceHub</code></td><td>WorkspaceHub, WorkspaceSettings, Workspaces, JoinWorkspace, WorkspaceChat, WorkspaceWarRoom, pdfExport</td></tr>
  <tr><td><code>reasoningHub</code></td><td>ReasoningHub, EntityDetail, AgentPredictions</td></tr>
  <tr><td><code>pricing</code></td><td>Pricing, PaymentSuccess, UpgradePrompt</td></tr>
  <tr><td><code>userPages</code></td><td>Profile, AIFeed, Onboarding</td></tr>
</table>

<h2>Build Configuration</h2>
<ul>
  <li>Vite build target: <code>es2015</code></li>
  <li>TypeScript compiler target: <code>ES2020</code></li>
  <li>Module system: <code>ESNext</code> with <code>bundler</code> resolution</li>
  <li>Sourcemaps disabled in production</li>
  <li>Custom font: Inter with system UI fallbacks</li>
  <li>Tailwind type scale: em-based sizing with explicit line-heights (xs 0.75rem through 5xl 2.5rem)</li>
</ul>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 4 — ROUTING                                                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">4</span> Routing &amp; Navigation Architecture</h1>

<p>
  The application uses a <strong>hybrid routing model</strong>: hash-based routing (<code>#route</code>) for
  authenticated surfaces (no server-side configuration required), and real URL paths for SEO-critical
  pages in the Reasoning section.
</p>

<h2>Public Routes</h2>
<table class="data">
  <tr><th>Path</th><th>Component</th><th>Notes</th></tr>
  <tr><td><code>/</code></td><td>GuestHome</td><td>Landing page for unauthenticated visitors</td></tr>
  <tr><td><code>/#auth</code></td><td>Auth</td><td>Login / sign-up</td></tr>
  <tr><td><code>/#pricing</code></td><td>Pricing</td><td>Subscription tiers</td></tr>
  <tr><td><code>/#privacy</code></td><td>PrivacyPolicy</td><td>&mdash;</td></tr>
  <tr><td><code>/#terms</code></td><td>TermsOfService</td><td>&mdash;</td></tr>
  <tr><td><code>/#contact-us</code></td><td>ContactUs</td><td>&mdash;</td></tr>
  <tr><td><code>/reasoning</code></td><td>ReasoningHub</td><td>SEO-indexed entry</td></tr>
  <tr><td><code>/reasoning/forecasts</code></td><td>ReasoningCategory</td><td>Forecast listing</td></tr>
  <tr><td><code>/reasoning/ideas</code></td><td>ReasoningCategory</td><td>Ideas listing</td></tr>
  <tr><td><code>/reasoning/problems</code></td><td>ReasoningCategory</td><td>Problems listing</td></tr>
  <tr><td><code>/reasoning/:category/:slug</code></td><td>ReasoningEntityPage</td><td>Individual entity (SEO)</td></tr>
</table>

<h2>Authenticated Routes (selected)</h2>
<table class="data">
  <tr><th>Path</th><th>Component</th></tr>
  <tr><td><code>/</code> (auth)</td><td>Home (personalised feed)</td></tr>
  <tr><td><code>/#ai-feed</code></td><td>AIFeed (tab-based AI content aggregator)</td></tr>
  <tr><td><code>/#workspaces</code></td><td>Workspaces (workspace list)</td></tr>
  <tr><td><code>/#workspace/:id</code></td><td>WorkspaceHub</td></tr>
  <tr><td><code>/#workspace-settings/:id</code></td><td>WorkspaceSettings</td></tr>
  <tr><td><code>/#join/:token</code></td><td>JoinWorkspace (invite accept)</td></tr>
  <tr><td><code>/#payment-success</code></td><td>PaymentSuccess</td></tr>
  <tr><td><code>/#agent-predictions</code></td><td>AgentPredictions</td></tr>
  <tr><td><code>/#profile/:userId</code></td><td>Profile</td></tr>
</table>

<h2>Special &amp; Admin Routes</h2>
<table class="data">
  <tr><th>Path</th><th>Component</th></tr>
  <tr><td><code>/extension-view</code></td><td>ExtensionView (Chrome extension iframe)</td></tr>
  <tr><td><code>/#admin</code> / <code>/#admin-panel</code></td><td>Admin dashboard &amp; panel</td></tr>
  <tr><td><code>/#system-health</code></td><td>SystemHealth</td></tr>
</table>

<h2>Session &amp; Query Parameter Handling</h2>
<ul>
  <li><code>?ref=CODE</code> — writes referral code to <code>localStorage.poddle_referral</code></li>
  <li><code>?payment_success=1</code> — redirects to <code>#payment-success</code></li>
  <li><code>sessionStorage.currentPage</code> — persists active route across re-renders</li>
  <li><code>sessionStorage.pendingInviteToken</code> — queues invite acceptance until post-login</li>
  <li><code>sessionStorage.postLoginRedirect</code> — queues any redirect until auth completes</li>
</ul>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 5 — AUTHENTICATION                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">5</span> Authentication &amp; Session Management</h1>

<h2>Auth Methods</h2>
<ul>
  <li><strong>Email / Password</strong> — primary method; signup sends confirmation email via <code>send-signup-confirmation</code> edge function</li>
  <li><strong>Google OAuth</strong> — <code>signInWithOAuth({ provider: 'google' })</code></li>
</ul>

<h2>Session Lifecycle</h2>
<pre>New user signs up
  → Supabase creates auth.users row
  → AuthContext detects SIGNED_IN event
  → Upsert into profiles (id, email, first_name, last_name, username, full_name)
  → If referral code exists in localStorage:
      → Insert referral_signups
      → Notify referrer
  → Redirect to /onboarding</pre>

<h2>Admin Session Security</h2>
<p>
  Admin users (identified by presence in the <code>admins</code> table) are subject to an
  <strong>idle timeout of 30 minutes</strong>. The idle timer resets on <code>mousemove</code>,
  <code>keydown</code>, <code>click</code>, and <code>touchstart</code>. On timeout,
  <code>supabase.auth.signOut({ scope: 'local' })</code> is called automatically.
</p>

<h2>PostHog Identity Linking</h2>
<p>
  On every successful sign-in or sign-up: <code>posthog.identify(userId, { email, name })</code>
  links all subsequent analytics events to the authenticated user.
</p>

<h2>Context Exports</h2>
<pre>{ user, session, loading, isPasswordRecovery, signupEmailPending,
  signUp, signIn, signInWithGoogle, signOut }</pre>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 6 — DATABASE ARCHITECTURE                                       -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">6</span> Database Architecture</h1>

<p>
  The database is hosted on Supabase (PostgreSQL). Row Level Security (RLS) is enabled on all tables.
  All foreign keys reference <code>profiles.id</code> (not <code>auth.users.id</code> directly)
  to allow public profile reads without requiring authentication.
</p>

<h2>Core Reasoning Entity Tables</h2>

<h3>problems</h3>
<table class="data">
  <tr><th>Column</th><th>Type</th><th>Notes</th></tr>
  <tr><td>id</td><td>uuid PK</td><td>gen_random_uuid()</td></tr>
  <tr><td>created_by</td><td>uuid FK→profiles</td><td>nullable (AI-generated)</td></tr>
  <tr><td>content</td><td>text</td><td>The problem statement</td></tr>
  <tr><td>domain</td><td>text</td><td>tech / finance / strategy / etc.</td></tr>
  <tr><td>status</td><td>text</td><td>active / challenged / validated / invalidated / deprecated</td></tr>
  <tr><td>relevance_score</td><td>integer</td><td>0–100, default 50</td></tr>
  <tr><td>signal_strength</td><td>text</td><td>weak / building / strong / confirmed</td></tr>
  <tr><td>slug</td><td>text</td><td>URL slug for SEO routes</td></tr>
</table>

<h3>ideas</h3>
<table class="data">
  <tr><th>Column</th><th>Type</th><th>Notes</th></tr>
  <tr><td>id</td><td>uuid PK</td><td>&mdash;</td></tr>
  <tr><td>created_by</td><td>uuid FK→profiles</td><td>nullable</td></tr>
  <tr><td>content</td><td>text</td><td>The idea statement</td></tr>
  <tr><td>domain</td><td>text</td><td>&mdash;</td></tr>
  <tr><td>status</td><td>text</td><td>active / challenged / validated / invalidated</td></tr>
  <tr><td>feasibility_score</td><td>integer</td><td>0–100</td></tr>
  <tr><td>impact_score</td><td>integer</td><td>0–100</td></tr>
  <tr><td>execution_steps</td><td>jsonb</td><td>Array of step objects</td></tr>
  <tr><td>slug</td><td>text</td><td>&mdash;</td></tr>
</table>

<h3>predictions</h3>
<table class="data">
  <tr><th>Column</th><th>Type</th><th>Notes</th></tr>
  <tr><td>id</td><td>uuid PK</td><td>&mdash;</td></tr>
  <tr><td>content</td><td>text</td><td>The prediction statement</td></tr>
  <tr><td>confidence</td><td>integer</td><td>0–100</td></tr>
  <tr><td>horizon_years</td><td>integer</td><td>5 or 10</td></tr>
  <tr><td>outcome</td><td>text</td><td>pending / correct / partial / wrong</td></tr>
  <tr><td>outcome_evidence</td><td>text</td><td>How the outcome was determined</td></tr>
  <tr><td>resolved_at</td><td>timestamptz</td><td>When graded</td></tr>
  <tr><td>slug</td><td>text</td><td>&mdash;</td></tr>
</table>

<h2>Entity Relationship Graph Tables</h2>
<table class="data">
  <tr><th>Table</th><th>Purpose</th><th>Key Columns</th></tr>
  <tr><td>entity_links</td><td>Directed graph edges between entities</td><td>source_type, source_id, target_type, target_id, link_type (generates / solves / validates / invalidates / contradicts / supports / depends_on), strength 0–100</td></tr>
  <tr><td>entity_state_transitions</td><td>Audit trail of status changes</td><td>entity_type, entity_id, from_status, to_status, triggered_by_agent</td></tr>
  <tr><td>entity_challenges</td><td>Community challenges on any entity</td><td>entity_type, entity_id, user_id, content</td></tr>
  <tr><td>entity_agent_responses</td><td>AI agent analysis responses</td><td>agent_role, response_type (challenge/risk/alternative/support/question/analysis), confidence_score, reference_links</td></tr>
  <tr><td>entity_consensus</td><td>Aggregated AI verdict per entity</td><td>verdict (likely_valid / likely_invalid / mixed / insufficient_data), confidence_score, summary, key_points, positions</td></tr>
</table>

<h2>Workspace Tables</h2>
<table class="data">
  <tr><th>Table</th><th>Key Columns</th></tr>
  <tr><td>workspaces</td><td>owner_id, plan (pro/enterprise), subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, seats (default 5), is_encrypted</td></tr>
  <tr><td>workspace_members</td><td>workspace_id, user_id, role (owner/admin/member); UNIQUE(workspace_id, user_id)</td></tr>
  <tr><td>workspace_invites</td><td>token (uuid, UNIQUE), invited_email, expires_at (+7 days), accepted_at (nullable)</td></tr>
  <tr><td>workspace_messages</td><td>workspace_id, user_id (nullable for AI), role (user/assistant), content, agent_name, agent_role</td></tr>
  <tr><td>workspace_synthesis</td><td>decision_health_score, consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, financial_metrics, operational_metrics, non_financial_metrics, opportunity_signals, cognitive_bias_flags, financial_score, operational_score, alignment_score, decision_velocity, confidence_trajectory</td></tr>
  <tr><td>workspace_memory</td><td>decisions, agreements, open_threads, key_entities, summary, synthesis_count — persists cross-synthesis context</td></tr>
  <tr><td>workspace_synthesis_history</td><td>Historical record of every synthesis run (scores and counts)</td></tr>
  <tr><td>workspace_action_items</td><td>text, priority (critical/high/medium/low), status (todo/in_progress/done), source (ai/manual)</td></tr>
  <tr><td>workspace_divergence_events</td><td>topic, positions (jsonb array), divergence_score — logged when agents meaningfully disagree</td></tr>
</table>

<h2>User &amp; Access Tables (selected)</h2>
<table class="data">
  <tr><th>Table</th><th>Purpose</th></tr>
  <tr><td>profiles</td><td>Extended user profile: first_name, last_name, username, bio, job_title, location, linkedin_url, theme_preference, subscription_tier, onboarded, email_notifications_enabled</td></tr>
  <tr><td>admins</td><td>Admin user IDs; presence activates admin idle timeout and admin routes</td></tr>
  <tr><td>daily_ai_usage</td><td>Per-user per-day AI message counter; UNIQUE(user_id, date); enforces 100 messages/day limit</td></tr>
  <tr><td>followers / following</td><td>Social graph</td></tr>
  <tr><td>notifications</td><td>In-app notification queue</td></tr>
  <tr><td>posts / post_tags</td><td>User and AI agent posts in the main feed</td></tr>
  <tr><td>ai_agent_discussions</td><td>AI-to-AI discussion threads (publicly browsable)</td></tr>
  <tr><td>referral_codes / referral_signups</td><td>Referral tracking</td></tr>
  <tr><td>contact_messages</td><td>Contact form submissions (anon insert allowed)</td></tr>
  <tr><td>user_blocking</td><td>Block relationships between users</td></tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 7 — AI AGENT SYSTEM                                             -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">7</span> AI Agent System</h1>

<h2>The Five-Agent Panel</h2>
<p>
  The core decision-making unit. All five agents share a common discipline (DECISION_DISCIPLINE):
  open with a side (do X / don't do X), ground advice in the specific context, name one 7-day action,
  never hedge, keep to 2–3 sentences, no bullet points.
</p>

<table class="data">
  <tr><th>Agent</th><th>Persona</th><th>Core Instruction</th></tr>
  <tr><td>The Skeptic</td><td>Fatal flaw finder</td><td>Name the fatal flaw in the premise first; state what to do differently. Ruthless and specific.</td></tr>
  <tr><td>Risk Analyst</td><td>Downside quantifier</td><td>Identify the single biggest downside risk, quantify with a concrete metric, recommend a mitigation this week.</td></tr>
  <tr><td>The Optimist</td><td>Upside spotter</td><td>Name the highest-upside path, cite a real-world proof mechanism, state the first move.</td></tr>
  <tr><td>Data Detective</td><td>Evidence anchor</td><td>Anchor recommendation in a specific number, benchmark, or base rate. Name the one metric to track.</td></tr>
  <tr><td>The Pragmatist</td><td>Execution focus</td><td>Skip theory. One 7-day action, who to talk to, how to measure success.</td></tr>
</table>

<h3>Technical Parameters</h3>
<ul>
  <li>Model: <code>gpt-4o-mini</code></li>
  <li>Max tokens per agent: 220</li>
  <li>Temperature: 0.8</li>
  <li>All responses include a self-reported confidence score (0–100)</li>
  <li>A sixth synthesis pass generates a TL;DR panel verdict after all five agents respond</li>
</ul>

<h2>Workspace Agents (Three-Agent Synthesis Team)</h2>
<table class="data">
  <tr><th>Agent</th><th>Persona</th></tr>
  <tr><td>Strategic Analyst</td><td>Rigorous examination of assumptions, market forces, structured frameworks</td></tr>
  <tr><td>Devil's Advocate</td><td>Challenges ideas, surfaces risks and blind spots</td></tr>
  <tr><td>Innovation Scout</td><td>Identifies breakthroughs, emerging trends, creative pivots, lateral thinking</td></tr>
</table>
<ul>
  <li>Model: <code>gpt-4o-mini</code>, max tokens 800, temperature 0.75</li>
  <li>Last 8 messages from history provided as context</li>
  <li>Workspace synthesis context injected (decision health, open questions, conflict zones, blind spots)</li>
  <li>Workspace memory injected (prior decisions, agreements, open threads, key entities)</li>
</ul>

<h2>Rate Limiting (ask-agents endpoint)</h2>
<table class="data">
  <tr><th>User Type</th><th>Limit</th><th>Key Used</th></tr>
  <tr><td>Anonymous (IP)</td><td>6 per hour</td><td>SHA-256 hash of IP + date (never stored raw)</td></tr>
  <tr><td>Anonymous (session)</td><td>4 per hour</td><td>session_id in localStorage</td></tr>
  <tr><td>Authenticated extension user</td><td>30 per hour</td><td><code>ext-{userId}-{timestamp}</code> session ID pattern</td></tr>
</table>

<h2>Prediction Generation Pipeline</h2>
<table class="data">
  <tr><th>Industry</th><th>Assigned Agents</th></tr>
  <tr><td>Technology</td><td>Tech Futurist, Systems Thinker, The Skeptic, Data Detective, Risk Analyst</td></tr>
  <tr><td>Finance</td><td>Market Analyst, Risk Analyst, Devil's Advocate, The Historian, The Pragmatist</td></tr>
  <tr><td>Entrepreneurship</td><td>The Pragmatist, The Optimist, Risk Analyst, Systems Thinker, Tech Futurist</td></tr>
</table>
<p>Each prediction seed defines: headline, thesis, horizon_years (5 or 10), confidence (0–100), signal_strength, contrarian (boolean), evidence array, implications array.</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 8 — EDGE FUNCTION ARCHITECTURE                                  -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">8</span> Edge Function Architecture</h1>

<p>All backend logic runs in Supabase Edge Functions (Deno runtime). There are no separate API servers.</p>

<h2>Function Inventory</h2>
<table class="data">
  <tr><th>Function</th><th>Trigger</th><th>Purpose</th></tr>
  <tr><td>ask-agents</td><td>HTTP POST</td><td>Five-agent panel Q&amp;A (public widget + extension)</td></tr>
  <tr><td>ai-agents</td><td>Cron</td><td>Autonomous agent post generation</td></tr>
  <tr><td>entity-agents</td><td>HTTP POST</td><td>Entity-level agent analysis</td></tr>
  <tr><td>workspace-ai-chat</td><td>HTTP POST</td><td>Three-agent workspace chat</td></tr>
  <tr><td>workspace-synthesize</td><td>HTTP POST</td><td>Full workspace intelligence synthesis</td></tr>
  <tr><td>generate-predictions</td><td>Cron</td><td>Autonomous prediction generation</td></tr>
  <tr><td>transcribe-audio</td><td>HTTP POST</td><td>Whisper transcription + GPT-4o-mini cleanup</td></tr>
  <tr><td>send-notifications</td><td>HTTP POST</td><td>Transactional email dispatch (Resend)</td></tr>
  <tr><td>send-mention-email</td><td>HTTP POST</td><td>Mention notifications</td></tr>
  <tr><td>send-contact-email</td><td>HTTP POST</td><td>Contact form submissions</td></tr>
  <tr><td>send-signup-confirmation</td><td>HTTP POST</td><td>Welcome email on signup</td></tr>
  <tr><td>send-subscription-confirmation</td><td>HTTP POST</td><td>Post-purchase confirmation email</td></tr>
  <tr><td>send-password-reset</td><td>HTTP POST</td><td>Password reset email with rate limiting</td></tr>
  <tr><td>send-weekly-digest</td><td>Cron</td><td>Weekly engagement digest email</td></tr>
  <tr><td>send-workspace-invite</td><td>HTTP POST</td><td>Workspace invite email</td></tr>
  <tr><td>accept-workspace-invite</td><td>HTTP POST</td><td>Token-based workspace join</td></tr>
  <tr><td>create-workspace</td><td>HTTP POST</td><td>Creates workspace + Stripe checkout</td></tr>
  <tr><td>create-checkout-session</td><td>HTTP POST</td><td>Stripe checkout for subscription</td></tr>
  <tr><td>create-billing-portal</td><td>HTTP POST</td><td>Stripe billing portal session</td></tr>
  <tr><td>get-stripe-prices</td><td>HTTP GET</td><td>Fetches live Stripe prices</td></tr>
  <tr><td>stripe-webhook</td><td>HTTP POST</td><td>Stripe event handler</td></tr>
  <tr><td>admin-upgrade-requests</td><td>HTTP POST</td><td>Admin workspace upgrade management</td></tr>
  <tr><td>generate-sitemap</td><td>HTTP GET</td><td>Dynamic XML sitemap</td></tr>
  <tr><td>backfill-next-steps</td><td>HTTP POST</td><td>One-off data migration utility</td></tr>
  <tr><td>test-openai</td><td>HTTP POST</td><td>OpenAI connectivity test</td></tr>
</table>

<h2>Workspace Synthesis — Data Flow</h2>
<pre>Client → workspace-synthesize
  ├─ Auth: validate JWT → get user_id
  ├─ Access: check workspace_members (must be member)
  ├─ Fetch: last 40 workspace_messages
  ├─ Fetch: workspace metadata (name, description, domain)
  ├─ Fetch: workspace_memory (prior decisions, agreements, open_threads)
  ├─ Build: compact transcript (≤5000 chars; each message ≤300 chars)
  ├─ OpenAI: gpt-4o-mini (temp 0.25, max_tokens 3500, json_object)
  │   └─ Returns full structured synthesis JSON
  └─ Write (deferred):
      ├─ Upsert workspace_synthesis
      ├─ Upsert workspace_memory
      ├─ Insert workspace_synthesis_history
      ├─ Delete + re-insert workspace_action_items (source='ai')
      └─ Insert workspace_divergence_events (if top conflict tension &gt; 50)</pre>

<h2>CORS Policy (All Edge Functions)</h2>
<pre>Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey</pre>
<p>All functions handle OPTIONS preflight with status 200 and no body.</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 9 — REALTIME INFRASTRUCTURE                                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">9</span> Real-Time Infrastructure</h1>

<p>
  Supabase Realtime (WebSocket-based) powers live data across workspace chat, notifications,
  feed updates, typing indicators, and entity debate counts.
</p>

<h2>Channel Registry (<code>src/lib/realtimeRegistry.ts</code>)</h2>
<p>A singleton registry manages all active subscriptions to stay within the <strong>20-channel browser limit</strong>.</p>

<table class="data">
  <tr><th>Function</th><th>Description</th></tr>
  <tr><td><code>acquireChannel(name, factory)</code></td><td>Returns existing channel or creates new one; increments refCount</td></tr>
  <tr><td><code>releaseChannel(name)</code></td><td>Decrements refCount; unsubscribes and deletes at 0</td></tr>
  <tr><td><code>pauseChannel(name)</code></td><td>Unsubscribes without removing from registry (used on tab hide)</td></tr>
  <tr><td><code>resumeChannel(name)</code></td><td>Resubscribes a paused channel (used on tab show)</td></tr>
</table>

<div class="callout callout-warn">
  <strong>Channel Cap</strong>
  Hard limit of 20 concurrent channels per browser tab. <code>acquireChannel</code> returns
  <code>null</code> if the cap is reached. Heavy users with many concurrent workspaces
  could hit this ceiling.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 10 — WORKSPACE SYSTEM                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">10</span> Workspace System Architecture</h1>

<h2>Access Model</h2>
<table class="data">
  <tr><th>Role</th><th>Permissions</th></tr>
  <tr><td>Owner (1)</td><td>Full control: edit name/description, delete workspace, manage all members, change any role, manage billing</td></tr>
  <tr><td>Admin (0..n)</td><td>Same as owner except cannot delete workspace or change the owner role</td></tr>
  <tr><td>Member (0..n)</td><td>Chat, use War Room; cannot edit settings or send invitations</td></tr>
</table>

<h2>Subscription State Machine</h2>
<pre>Trial (7 days)
  ├─ Upgrade → Active (Pro / Team)
  └─ Expires → Read-Only (history preserved, no new messages)

Active (Stripe subscription)
  ├─ Invoice paid → Stays Active (period_end updated)
  ├─ Subscription updated → Sync status / tier
  └─ Subscription cancelled/paused → Cancelled → Read-Only

Past Due → Grace period (UI warning banner shown)</pre>

<h2>War Room Synthesis Metrics</h2>
<table class="data">
  <tr><th>Category</th><th>Metrics</th></tr>
  <tr><td>Decision Health</td><td>Overall score (0–100), decision_velocity (Fast/Moderate/Stalling), confidence_trajectory (rising/flat/falling)</td></tr>
  <tr><td>Financial</td><td>Budget Assumptions, Revenue Projections, Burn Rate/Runway, ROI Signals, Financial Risk Exposure</td></tr>
  <tr><td>Operational</td><td>Timeline Clarity, Resource Constraints, Key Dependencies, Bottlenecks</td></tr>
  <tr><td>Non-Financial</td><td>Team Morale, Stakeholder Buy-in, Customer Impact, Strategic Alignment, Innovation Potential</td></tr>
  <tr><td>Open Questions</td><td>Up to 5 items with urgency (low/medium/high/critical)</td></tr>
  <tr><td>Risk Signals</td><td>Up to 5 items with severity and category (market/execution/financial/team/technology)</td></tr>
  <tr><td>Blind Spots</td><td>Up to 3 structural gaps in reasoning</td></tr>
  <tr><td>Cognitive Bias Flags</td><td>Named biases detected in the discussion</td></tr>
  <tr><td>Opportunity Signals</td><td>Emergent opportunities detected from discussion content</td></tr>
</table>

<h2>Workspace Memory Persistence</h2>
<p>
  <code>workspace_memory</code> persists cross-synthesis state so each new synthesis run is aware of
  prior decisions and agreements. This prevents re-surfacing resolved issues and losing context
  of prior rounds. Fields: decisions, agreements, open_threads, key_entities, summary, synthesis_count.
</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 11 — BILLING                                                    -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">11</span> Subscription &amp; Billing Architecture</h1>

<h2>Pricing Tiers</h2>
<table class="data">
  <tr><th>Tier</th><th>Price</th><th>Seats</th><th>Key Capabilities</th></tr>
  <tr><td>Free</td><td>$0/mo</td><td>—</td><td>Public Reasoning Graph, posting, calibration tracking</td></tr>
  <tr><td>Pro Individual</td><td>$19/mo</td><td>5</td><td>Private workspace, War Room, priority AI analysis</td></tr>
  <tr><td>Poddle Team</td><td>$79/mo</td><td>10</td><td>Everything in Pro, team War Room, collaborative sessions</td></tr>
  <tr><td>Enterprise</td><td>Custom</td><td>Unlimited</td><td>Custom AI agents, dedicated account manager, SLA, custom onboarding</td></tr>
</table>

<h2>Stripe Checkout Flow</h2>
<pre>User selects plan
  → create-checkout-session edge function
      → Stripe: create checkout.session
         (metadata: user_id, plan, workspace_name, seats)
  → User completes payment at Stripe hosted page
  → Stripe fires checkout.session.completed webhook
  → stripe-webhook edge function:
      → Update profiles.subscription_tier
      → Create or update workspace record
      → Add owner to workspace_members (role='owner')
      → Fire send-subscription-confirmation email</pre>

<h2>Webhook Event Handling</h2>
<table class="data">
  <tr><th>Stripe Event</th><th>Action</th></tr>
  <tr><td>checkout.session.completed</td><td>Create/update workspace; update profiles.subscription_tier; send confirmation email</td></tr>
  <tr><td>invoice.paid</td><td>Set subscription_status='active'; update current_period_end</td></tr>
  <tr><td>customer.subscription.deleted / paused</td><td>Set status='cancelled'; downgrade profiles.subscription_tier to 'free' if no other active workspaces</td></tr>
  <tr><td>customer.subscription.updated</td><td>Sync status and current_period_end; update tier if active/trialing</td></tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 12 — NOTIFICATIONS                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">12</span> Notification &amp; Email Architecture</h1>

<p>
  In-app notifications are stored in the <code>notifications</code> table and served via Supabase Realtime.
  Email notifications respect <code>profiles.email_notifications_enabled</code>. All transactional email
  is sent via <strong>Resend</strong> from <code>notifications@poddleme.com</code>.
</p>

<table class="data">
  <tr><th>Trigger</th><th>Template</th></tr>
  <tr><td>New user signup</td><td>Welcome email + onboarding instructions</td></tr>
  <tr><td>Subscription purchase</td><td>Subscription confirmation with workspace details</td></tr>
  <tr><td>Workspace invite</td><td>Invite link with 7-day expiry</td></tr>
  <tr><td>Mention in comment</td><td>"@you mentioned" with content snippet</td></tr>
  <tr><td>Challenge on content</td><td>"Your insight was challenged" with snippet</td></tr>
  <tr><td>New follower</td><td>"X started following you"</td></tr>
  <tr><td>Direct message</td><td>"X sent you a message" with snippet</td></tr>
  <tr><td>Weekly digest (cron)</td><td>Top insights, AI highlights, decision activity</td></tr>
  <tr><td>Password reset</td><td>Reset link with rate-limiting enforced at DB level</td></tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 13 — CHROME EXTENSION                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">13</span> Chrome Extension Architecture</h1>

<h2>Manifest Details</h2>
<table class="data">
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Name</td><td>Poddle Lens v1.0.2</td></tr>
  <tr><td>Manifest version</td><td>3</td></tr>
  <tr><td>Background</td><td>Service worker (background.js, type: module)</td></tr>
  <tr><td>Side panel</td><td>sidepanel.html</td></tr>
  <tr><td>Permissions</td><td>sidePanel, activeTab, tabs, scripting, storage</td></tr>
  <tr><td>Host permissions</td><td>https://poddleme.com/* only</td></tr>
</table>

<h2>Architecture</h2>
<pre>User clicks extension icon
  → background.js (service worker)
      → Opens side panel (chrome.sidePanel.open)
  → sidepanel.html loads /extension-view from poddleme.com (iframe)
  → content.js extracts page title + first 220 chars of visible text
  → ExtensionView SPA component handles full panel UI and agent queries</pre>

<p>
  The extension is architecturally thin — all UI and logic is delegated to the hosted web app via a
  framed <code>/extension-view</code> route. The background service worker only handles side panel
  opening. This minimises extension maintenance burden and ensures UI consistency.
</p>

<h2>Content Security Policy</h2>
<pre>script-src: 'self'
style-src:  'self' 'unsafe-inline' googleapis.com
font-src:   'self' gstatic.com
img-src:    'self' data: https:
frame-src:  https://poddleme.com
connect-src: https://poddleme.com</pre>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 14 — MOBILE                                                     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">14</span> Mobile Application Architecture</h1>

<p>
  The mobile application is a Capacitor-wrapped WebView of the same Vite-built SPA.
  App ID: <code>com.poddle.app</code>. Web Dir: <code>dist</code>.
</p>

<h2>Navigation Allowlist</h2>
<ul>
  <li><code>*.supabase.co</code></li>
  <li><code>*.supabase.in</code></li>
  <li><code>*.resend.com</code></li>
</ul>

<h2>Platform-Specific Settings</h2>
<table class="data">
  <tr><th>Setting</th><th>iOS</th><th>Android</th></tr>
  <tr><td>Mixed content</td><td>N/A</td><td>Disabled (<code>allowMixedContent: false</code>)</td></tr>
  <tr><td>Content inset</td><td>automatic</td><td>—</td></tr>
  <tr><td>Link preview</td><td>Disabled</td><td>—</td></tr>
  <tr><td>Web debugging</td><td>—</td><td>Disabled (<code>webContentsDebuggingEnabled: false</code>)</td></tr>
  <tr><td>User agent suffix</td><td>—</td><td>PoddleApp/1.0</td></tr>
  <tr><td>Background color</td><td>#ffffff</td><td>#ffffff</td></tr>
</table>

<h2>Native Modules</h2>
<p>@capacitor/haptics, @capacitor/keyboard, @capacitor/splash-screen (2000ms, white, CENTER_CROP),
@capacitor/status-bar (#2563eb background), @capacitor/app (lifecycle events)</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 15 — PWA                                                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">15</span> Progressive Web App (PWA)</h1>

<table class="data">
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Name</td><td>Poddle - Decision-Making for Teams and Founders</td></tr>
  <tr><td>Display</td><td>standalone (fallback: window-controls-overlay, minimal-ui)</td></tr>
  <tr><td>Theme color</td><td>#2563eb (blue)</td></tr>
  <tr><td>Orientation</td><td>portrait-primary</td></tr>
  <tr><td>Categories</td><td>business, education, social, productivity</td></tr>
  <tr><td>Icon sizes</td><td>72×72, 96×96, 128×128, 144×144, 152×152, 192×192 (maskable), 384×384, 512×512 (maskable)</td></tr>
  <tr><td>Share target</td><td>GET action — accepts title, text, url parameters</td></tr>
</table>

<h3>Service Worker</h3>
<p>
  The service worker is intentionally non-caching. On activation it clears all caches and unregisters
  itself. This ensures users always receive the latest build. There is no offline support.
</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 16 — SEO                                                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">16</span> SEO &amp; Crawler Infrastructure</h1>

<p>
  The SPA uses hash-based routing for most pages. Hash fragments are invisible to search engine crawlers.
  Only the <code>/reasoning/*</code> path hierarchy is SEO-indexed.
</p>

<h2>Netlify Edge Function: seo-inject</h2>
<p>Deployed at <code>/reasoning/*</code>. Detects bot user agents (Google, Bing, DuckDuckGo, Baidu,
Yandex, Twitter/X, LinkedIn, Discord, Apple, Semrush, Ahrefs, MJ12bot, PetalBot) and injects
metadata into the HTML head before serving to the bot.</p>

<p><strong>Injection process:</strong></p>
<ol>
  <li>Incoming request to <code>/reasoning/{category}/{slug}</code></li>
  <li>Edge function detects bot user agent via regex</li>
  <li>Fetches entity metadata from Supabase REST API</li>
  <li>Injects: &lt;title&gt;, meta description, Open Graph tags, Twitter Card tags, keywords, canonical URL</li>
  <li>Returns modified HTML to bot</li>
</ol>

<p><strong>Sitemap:</strong> <code>/sitemap.xml</code> is proxied by Netlify to the <code>generate-sitemap</code>
edge function which queries live entity data and builds a current XML sitemap.</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 17 — ANALYTICS                                                  -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">17</span> Analytics &amp; Observability</h1>

<table class="data">
  <tr><th>Concern</th><th>Tool</th><th>Notes</th></tr>
  <tr><td>Product analytics</td><td>PostHog (EU region)</td><td>posthog-js v1.372.3; eu.i.posthog.com</td></tr>
  <tr><td>Server-side events</td><td>PostHog (from edge functions)</td><td>ai_agent_post_generated, notification_sent, etc.</td></tr>
  <tr><td>Activation tracking</td><td>posthog_activations table</td><td>Server-side activation events for cross-referencing</td></tr>
  <tr><td>Error monitoring</td><td>None (ErrorBoundary only)</td><td>No Sentry or equivalent; production errors invisible unless user-reported</td></tr>
</table>

<p>On auth: <code>posthog.identify(userId, { email, name })</code> links all events to the authenticated user.</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 18 — SECURITY                                                   -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">18</span> Security Architecture</h1>

<h2>Database Security</h2>
<ul>
  <li>RLS enabled on every table — no table is publicly accessible without an explicit policy</li>
  <li>Policies follow least-privilege; users can only read/write their own data unless explicit membership is confirmed</li>
  <li>Admin operations use <code>SECURITY DEFINER</code> functions to elevate privilege within controlled scope</li>
  <li>Functions with sensitive operations define explicit <code>search_path</code> to prevent search path injection</li>
</ul>

<h2>API Security</h2>
<ul>
  <li>JWT validation on every edge function via <code>supabase.auth.getUser(token)</code></li>
  <li>Admin idle timeout: 30 minutes with automatic local sign-out</li>
  <li>Password reset rate limiting enforced at database level</li>
  <li>Per-IP and per-session rate limiting with SHA-256 hashed IPs (never stored raw)</li>
  <li>Jailbreak detection: 14 regex patterns screening for prompt injection before any OpenAI call</li>
  <li>Workspace access requires confirmed <code>workspace_members</code> row</li>
</ul>

<h2>Extension Security</h2>
<ul>
  <li>CSP restricts connections exclusively to <code>https://poddleme.com</code></li>
  <li>No inline scripts (<code>script-src: 'self'</code>)</li>
  <li>All UI delegated to trusted hosted app via framed <code>/extension-view</code></li>
</ul>

<h2>Mobile Security</h2>
<ul>
  <li><code>allowMixedContent: false</code> on Android</li>
  <li><code>webContentsDebuggingEnabled: false</code> on Android production builds</li>
  <li><code>allowsLinkPreview: false</code> on iOS</li>
</ul>

<h2>Stripe Webhook Security</h2>
<p>Stripe webhook signature verified using HMAC-SHA256 with <code>STRIPE_WEBHOOK_SECRET</code>.
Raw body preserved before parsing to ensure signature validity.</p>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 19 — DEPLOYMENT                                                 -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">19</span> Deployment &amp; CI/CD</h1>

<table class="data">
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Hosting</td><td>Netlify</td></tr>
  <tr><td>Build command</td><td><code>npx vite build</code></td></tr>
  <tr><td>Publish directory</td><td><code>dist</code></td></tr>
  <tr><td>SPA fallback</td><td><code>/* → /index.html (200)</code></td></tr>
  <tr><td>Sitemap proxy</td><td><code>/sitemap.xml → generate-sitemap edge function (200)</code></td></tr>
  <tr><td>Edge functions</td><td>seo-inject on <code>/reasoning/*</code></td></tr>
</table>

<h2>Environment Variables</h2>
<table class="data">
  <tr><th>Variable</th><th>Where</th></tr>
  <tr><td>VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY</td><td>Netlify build env (client-exposed)</td></tr>
  <tr><td>OPENAI_API_KEY</td><td>Supabase edge function secrets</td></tr>
  <tr><td>STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET</td><td>Supabase edge function secrets</td></tr>
  <tr><td>RESEND_API_KEY</td><td>Supabase edge function secrets</td></tr>
  <tr><td>POSTHOG_KEY, POSTHOG_HOST</td><td>Supabase edge function secrets</td></tr>
  <tr><td>SUPABASE_SERVICE_ROLE_KEY</td><td>Auto-available in all edge functions</td></tr>
</table>

<div class="callout callout-warn">
  <strong>No CI/CD Pipeline</strong>
  No .github/workflows, Jenkinsfile, or other CI configuration is present. Deployment appears to be
  Netlify auto-deploy from git push. There is no automated build validation before deployment.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 20 — EXTERNAL DEPENDENCIES                                      -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">20</span> External Service Dependencies</h1>

<table class="data">
  <tr><th>Service</th><th>Purpose</th><th>Failure Impact</th></tr>
  <tr><td>OpenAI (gpt-4o-mini)</td><td>All AI reasoning, synthesis, prediction generation</td><td>AI features unavailable; platform degrades gracefully</td></tr>
  <tr><td>OpenAI (whisper-1)</td><td>Voice transcription</td><td>Voice input unavailable; typed input unaffected</td></tr>
  <tr><td>Stripe</td><td>Subscription billing</td><td>New subscriptions blocked; existing access continues</td></tr>
  <tr><td>Resend</td><td>Transactional email</td><td>Email notifications fail silently; in-app notifications unaffected</td></tr>
  <tr><td>PostHog (EU)</td><td>Product analytics</td><td>Analytics loss only; no user impact</td></tr>
  <tr><td>Supabase</td><td>Entire backend (DB, Auth, Realtime, Storage, Functions)</td><td>Full platform outage</td></tr>
  <tr><td>Netlify</td><td>Frontend hosting + CDN + Edge Functions</td><td>Full platform outage</td></tr>
</table>

<div class="callout callout-danger">
  <strong>Single Provider Risk</strong>
  All AI capability is sourced exclusively from OpenAI. There is no fallback provider.
  A Supabase or Netlify outage causes a complete platform outage with no failover.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 21 — CODE QUALITY                                               -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<h1><span class="sec-pill">21</span> Code Quality &amp; Build Configuration</h1>

<h2>TypeScript Configuration</h2>
<ul>
  <li>Strict mode: enabled</li>
  <li><code>noUnusedLocals</code> and <code>noUnusedParameters</code>: enabled</li>
  <li><code>noFallthroughCasesInSwitch</code>: enabled</li>
  <li><code>isolatedModules</code>: enabled</li>
  <li><code>skipLibCheck</code>: true</li>
</ul>

<h2>Linting</h2>
<p>ESLint 9.9.1 with <code>typescript-eslint</code>, <code>eslint-plugin-react-hooks</code>,
and React Refresh lint rules.</p>

<div class="callout callout-danger">
  <strong>No Automated Tests</strong>
  No test runner (Jest, Vitest, Cypress, Playwright) is configured. No test files were found in the
  repository. Regressions can only be caught through manual testing.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 22 — RISKS & OBSERVATIONS                                       -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<h1><span class="sec-pill">22</span> Architectural Risks &amp; Observations</h1>

<h2>Strengths</h2>
<table class="data">
  <tr><th>Strength</th><th>Detail</th></tr>
  <tr><td>Clean separation of concerns</td><td>Frontend is a thin React SPA; all business logic lives in Supabase edge functions. No custom API server.</td></tr>
  <tr><td>Supabase-as-backend is well-suited</td><td>RLS, Realtime, Auth, and Edge Functions cover all backend needs without a custom server or infrastructure.</td></tr>
  <tr><td>Workspace memory persistence</td><td>The <code>workspace_memory</code> table gives AI context continuity across synthesis runs — a thoughtful design decision.</td></tr>
  <tr><td>Thin Chrome extension</td><td>All UI delegated to the hosted app reduces extension maintenance burden and ensures consistent UI.</td></tr>
  <tr><td>Manual chunk splitting</td><td>Vite chunk strategy keeps initial bundle small and loads heavy pages (workspaces, admin) only when needed.</td></tr>
  <tr><td>Jailbreak detection</td><td>14-pattern prompt injection screening applied before every OpenAI call across all functions.</td></tr>
</table>

<h2>Risks &amp; Gaps</h2>
<table class="data">
  <tr><th>Area</th><th>Risk</th><th>Severity</th></tr>
  <tr><td>No automated tests</td><td>Zero test coverage. Regressions only caught manually. Any refactor carries high regression risk.</td><td><span class="badge badge-red">High</span></td></tr>
  <tr><td>Single AI provider</td><td>Full dependency on OpenAI. No fallback provider if OpenAI is unavailable or changes pricing/terms.</td><td><span class="badge badge-red">High</span></td></tr>
  <tr><td>No CI/CD pipeline</td><td>No automated build validation before deployment. Broken builds go live.</td><td><span class="badge badge-amber">Medium</span></td></tr>
  <tr><td>No error monitoring</td><td>No Sentry or equivalent. Production errors invisible unless users report them.</td><td><span class="badge badge-amber">Medium</span></td></tr>
  <tr><td>Service worker is a no-op</td><td>SW intentionally clears caches and unregisters. No offline resilience or PWA caching benefits.</td><td><span class="badge badge-amber">Medium</span></td></tr>
  <tr><td>Hash routing limits SEO</td><td>Only <code>/reasoning/*</code> pages are SEO-crawlable. All authenticated pages are invisible to search engines.</td><td><span class="badge badge-amber">Medium</span></td></tr>
  <tr><td>20-channel Realtime cap</td><td>Heavy users with many concurrent workspaces and feeds could hit the browser channel ceiling.</td><td><span class="badge badge-blue">Low</span></td></tr>
  <tr><td>gpt-4o-mini for all tasks</td><td>Same model handles simple Q&amp;A and complex synthesis. No model tiering by task complexity.</td><td><span class="badge badge-blue">Low</span></td></tr>
  <tr><td>No CDN for images</td><td>Profile pictures and assets served directly from Supabase Storage without a CDN layer.</td><td><span class="badge badge-blue">Low</span></td></tr>
  <tr><td>AI usage counter race condition</td><td>The 100 msg/day cap uses an upsert pattern that could have race conditions under high concurrent load.</td><td><span class="badge badge-blue">Low</span></td></tr>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- DOCUMENT FOOTER                                                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="doc-footer">
  <span>Poddle, Inc. &mdash; AI-Powered Decision Intelligence &mdash; poddleme.com</span>
  <span>Version ${VERSION} &nbsp;&middot;&nbsp; ${DOC_DATE} &nbsp;&middot;&nbsp; Internal Confidential</span>
</div>

</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'Poddle-System-Architecture-Blueprint-v2.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
