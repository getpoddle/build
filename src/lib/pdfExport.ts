export interface ChatMessageExport {
  role: 'user' | 'assistant';
  content: string;
  agent_name?: string;
  agent_role?: string;
  created_at: string;
}

export interface WarRoomExport {
  workspaceName: string;
  topic?: string;
  generatedAt: string;
  messageCount: number;
  decisionHealthScore: number;
  healthRationale?: string;
  financialScore?: number | null;
  operationalScore?: number | null;
  alignmentScore?: number | null;
  decisionVelocity?: string | null;
  confidenceTrajectory?: string | null;
  consensusPoints: Array<{ text: string; confidence: number; source_count: number }>;
  conflictZones: Array<{ topic: string; agent_a: string; position_a: string; agent_b: string; position_b: string; tension_level: number }>;
  openQuestions: Array<{ question: string; urgency: string }>;
  riskSignals: Array<{ signal: string; severity: string; category: string }>;
  blindSpots: Array<{ area: string; description: string }>;
  actionItems?: Array<{ text: string; priority: string; status: string; source: string }>;
  financialMetrics?: Array<{ metric: string; value: string; confidence: string; note: string }>;
  operationalMetrics?: Array<{ metric: string; status: string; note: string }>;
  nonFinancialMetrics?: Array<{ metric: string; signal: string; note: string }>;
  opportunitySignals?: Array<{ title: string; description: string; confidence: string; source: string }>;
  cognitiveBiasFlags?: Array<{ bias_name: string; explanation: string; counter_question: string }>;
}

export interface BoardBriefExport {
  workspaceName: string;
  topic?: string;
  generatedAt: string;
  decisionHealthScore: number;
  healthRationale?: string;
  financialScore?: number | null;
  operationalScore?: number | null;
  alignmentScore?: number | null;
  consensusPoints: Array<{ text: string; confidence: number }>;
  riskSignals: Array<{ signal: string; severity: string }>;
  actionItems: Array<{ text: string; priority: string; status: string }>;
  opportunitySignals?: Array<{ title: string; description: string; confidence: string; source: string }>;
  synthesisRunNumber?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function scoreColor(s: number): string {
  return s >= 70 ? '#16a34a' : s >= 45 ? '#f59e0b' : '#dc2626';
}

function scoreLabel(s: number): string {
  return s >= 70 ? 'Sharp' : s >= 45 ? 'Developing' : 'Fragmented';
}

function severityColor(sev: string): string {
  const map: Record<string, string> = { critical: '#dc2626', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' };
  return map[sev?.toLowerCase()] || '#94a3b8';
}


function severityText(sev: string): string {
  const map: Record<string, string> = { critical: '#b91c1c', high: '#b45309', medium: '#1d4ed8', low: '#475569' };
  return map[sev?.toLowerCase()] || '#475569';
}

// ─── SVG Generators (render in print perfectly) ───────────────────────────────

function svgScoreRing(score: number): string {
  const safe = Math.max(0, Math.min(100, score));
  const r = 44, cx = 56, cy = 56, sw = 9;
  const circ = 2 * Math.PI * r;
  const dash = (safe / 100) * circ;
  const c = scoreColor(safe);
  return `
    <svg width="112" height="112" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${sw}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${sw}"
        stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        font-size="22" font-weight="900" fill="${c}">${safe}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        font-size="9" fill="#94a3b8">/ 100</text>
    </svg>`;
}

function svgConsensusBar(confidence: number, color: string): string {
  const safe = Math.max(0, Math.min(100, confidence));
  const totalW = 160, h = 7, r = 3;
  const fillW = Math.max(r * 2, (safe / 100) * totalW);
  return `
    <svg width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${totalW}" height="${h}" rx="${r}" fill="#e2e8f0"/>
      <rect x="0" y="0" width="${fillW.toFixed(1)}" height="${h}" rx="${r}" fill="${color}"/>
    </svg>`;
}

function svgTensionBar(level: number): string {
  const safe = Math.max(0, Math.min(100, level));
  const totalW = 120, h = 6, r = 3;
  const fillW = Math.max(r * 2, (safe / 100) * totalW);
  const c = safe >= 70 ? '#dc2626' : safe >= 45 ? '#f59e0b' : '#3b82f6';
  return `
    <svg width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${totalW}" height="${h}" rx="${r}" fill="#e2e8f0"/>
      <rect x="0" y="0" width="${fillW.toFixed(1)}" height="${h}" rx="${r}" fill="${c}"/>
    </svg>`;
}

function svgRiskMatrix(risks: WarRoomExport['riskSignals']): string {
  const SEVS = ['low', 'medium', 'high', 'critical'];
  const CATS = ['market', 'execution', 'financial', 'team', 'technology'];
  const cellW = 90, cellH = 38;
  const marginLeft = 56, marginBottom = 28;
  const W = marginLeft + CATS.length * cellW + 8;
  const H = marginBottom + SEVS.length * cellH + 8;

  let cells = '';
  // Draw grid
  for (let si = 0; si < SEVS.length; si++) {
    for (let ci = 0; ci < CATS.length; ci++) {
      const x = marginLeft + ci * cellW;
      const y = (SEVS.length - 1 - si) * cellH;
      const intensity = (si / (SEVS.length - 1)) * 0.08 * (ci / (CATS.length - 1) + 0.4);
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="rgba(220,38,38,${intensity.toFixed(3)})" stroke="#e2e8f0" stroke-width="0.5"/>`;
    }
  }

  // Y-axis labels (severity)
  for (let si = 0; si < SEVS.length; si++) {
    const y = (SEVS.length - 1 - si) * cellH + cellH / 2 + 4;
    const c = severityText(SEVS[si]);
    cells += `<text x="${marginLeft - 6}" y="${y}" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="8" font-weight="700" fill="${c}" text-transform="capitalize">${SEVS[si]}</text>`;
  }

  // X-axis labels (category)
  for (let ci = 0; ci < CATS.length; ci++) {
    const x = marginLeft + ci * cellW + cellW / 2;
    const y = SEVS.length * cellH + 16;
    cells += `<text x="${x}" y="${y}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="8" fill="#64748b">${CATS[ci]}</text>`;
  }

  // Plot risk dots — track occupied cells to offset overlaps
  const occupied: Record<string, number> = {};
  risks.forEach((r, i) => {
    const si = SEVS.indexOf(r.severity?.toLowerCase());
    const ci = CATS.indexOf(r.category?.toLowerCase());
    if (si < 0 || ci < 0) return;
    const cellKey = `${si}-${ci}`;
    const offset = (occupied[cellKey] || 0) * 14;
    occupied[cellKey] = (occupied[cellKey] || 0) + 1;
    const cx = marginLeft + ci * cellW + cellW / 2 - offset;
    const cy = (SEVS.length - 1 - si) * cellH + cellH / 2;
    const c = severityColor(r.severity);
    cells += `<circle cx="${cx}" cy="${cy}" r="11" fill="${c}" stroke="white" stroke-width="2"/>`;
    cells += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="9" font-weight="900" fill="white">${i + 1}</text>`;
  });

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      style="display:block;max-width:100%;">
      ${cells}
    </svg>`;
}

// ─── Base Styles ─────────────────────────────────────────────────────────────

const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: #fff;
    line-height: 1.55;
    width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @media print {
    html, body {
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* Hide the screen toolbar */
    .print-toolbar { display: none !important; }
  }

  /* ── Screen toolbar (only shown on screen, hidden in print) ── */
  .print-toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: #0f172a;
    color: #fff;
    gap: 12px;
  }
  .print-toolbar-title {
    font-size: 10pt; font-weight: 700; color: #e2e8f0; flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .btn-print {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 18px;
    background: #2563eb; color: #fff;
    border: none; border-radius: 8px;
    font-size: 9.5pt; font-weight: 700;
    cursor: pointer; white-space: nowrap;
  }
  .btn-print:hover { background: #1d4ed8; }
  .btn-close {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    background: rgba(255,255,255,0.10); color: #e2e8f0;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
    font-size: 9.5pt; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    text-decoration: none;
  }
  .btn-close:hover { background: rgba(255,255,255,0.18); }

  .print-root {
    padding: 28px 36px 40px 36px;
    max-width: 820px;
    margin: 0 auto;
  }
  /* In print: small inner padding supplements the @page margins */
  @media print { .print-root { padding: 0 6px 0 6px; max-width: 100%; } }

  /* ── Logo ── */
  .logo-wrap { display: flex; align-items: center; gap: 8px; }
  .logo-box {
    width: 26px; height: 26px; border-radius: 7px;
    background: linear-gradient(135deg, #1e3a5f, #2563eb);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .logo-dot { width: 11px; height: 11px; border-radius: 50%; background: #fff; }
  .logo-text { font-size: 13pt; font-weight: 900; letter-spacing: -0.03em; color: #0f172a; }
  .logo-sub { font-size: 8pt; font-weight: 600; color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase; }

  /* ── Per-page header + footer via @page margin boxes (Chrome-supported) ── */
  .page-header { display: none; }
  @media print {
    @page {
      margin: 22mm 24mm 18mm 24mm;
      size: A4;
      @top-right {
        content: "Poddle · poddleme.com";
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 7pt;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.04em;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 4pt;
      }
      @bottom-left {
        content: "poddleme.com";
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 7pt;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.04em;
        border-top: 1px solid #e2e8f0;
        padding-top: 4pt;
      }
      @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 7pt;
        color: #94a3b8;
        border-top: 1px solid #e2e8f0;
        padding-top: 4pt;
      }
      @bottom-right {
        content: "Confidential";
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 7pt;
        color: #94a3b8;
        border-top: 1px solid #e2e8f0;
        padding-top: 4pt;
      }
    }
  }

  /* ── Doc header ── */
  .doc-header {
    border-bottom: 2px solid #1e3a5f;
    padding-bottom: 14px; margin-bottom: 22px; margin-top: 18px;
  }
  .doc-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .brand { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
  .title { font-size: 18pt; font-weight: 900; color: #0f172a; line-height: 1.2; }
  .subtitle { font-size: 9pt; color: #64748b; margin-top: 3px; }
  .meta-right { font-size: 8pt; font-weight: 600; color: #64748b; text-align: right; line-height: 1.7; }

  /* ── Score block ── */
  .score-block {
    background: #0f172a !important;
    color: #fff;
    border-radius: 12px;
    padding: 16px 22px;
    margin-bottom: 22px;
    display: flex; align-items: center; gap: 20px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .score-label { font-size: 12pt; font-weight: 900; margin-bottom: 2px; }
  .score-sub { font-size: 8pt; color: #94a3b8; margin-bottom: 8px; }
  .score-rationale { font-size: 9pt; color: #cbd5e1; line-height: 1.55; }

  /* ── Sections ──
     No page-break-inside on the section wrapper — sections can span pages freely.
     Individual rows use avoid so a single row doesn't split mid-line.
  ── */
  .section { margin-bottom: 20px; }
  .section-hdr {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 14px;
    border-radius: 8px 8px 0 0;
    font-size: 8.5pt; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em;
    border: 1px solid transparent; border-bottom: none;
    page-break-after: avoid; break-after: avoid;
  }
  .section-body { border-radius: 0 0 8px 8px; border: 1px solid transparent; border-top: none; }
  .row {
    padding: 10px 14px;
    border-top: 1px solid transparent;
    font-size: 9.5pt; line-height: 1.5;
    background: #fff !important;
    page-break-inside: avoid; break-inside: avoid;
  }

  /* Consensus */
  .sec-consensus .section-hdr { background: rgba(22,163,74,0.10) !important; color: #14532d; border-color: rgba(22,163,74,0.25); }
  .sec-consensus .section-body { border-color: rgba(22,163,74,0.2); }
  .sec-consensus .row { border-color: rgba(22,163,74,0.1); }

  /* Conflicts */
  .sec-conflicts .section-hdr { background: rgba(245,158,11,0.10) !important; color: #78350f; border-color: rgba(245,158,11,0.3); }
  .sec-conflicts .section-body { border-color: rgba(245,158,11,0.25); }
  .sec-conflicts .row { border-color: rgba(245,158,11,0.12); }

  /* Questions */
  .sec-questions .section-hdr { background: rgba(37,99,235,0.08) !important; color: #1e3a8a; border-color: rgba(37,99,235,0.22); }
  .sec-questions .section-body { border-color: rgba(37,99,235,0.2); }
  .sec-questions .row { border-color: rgba(37,99,235,0.08); }

  /* Risks */
  .sec-risks .section-hdr { background: rgba(220,38,38,0.08) !important; color: #7f1d1d; border-color: rgba(220,38,38,0.22); }
  .sec-risks .section-body { border-color: rgba(220,38,38,0.2); }
  .sec-risks .row { border-color: rgba(220,38,38,0.1); }

  /* Blind spots */
  .sec-blindspots .section-hdr { background: rgba(8,145,178,0.08) !important; color: #0c4a6e; border-color: rgba(8,145,178,0.22); }
  .sec-blindspots .section-body { border-color: rgba(8,145,178,0.2); }
  .sec-blindspots .row { border-color: rgba(8,145,178,0.1); }

  /* Actions */
  .sec-actions .section-hdr { background: rgba(124,58,237,0.08) !important; color: #4c1d95; border-color: rgba(124,58,237,0.22); }
  .sec-actions .section-body { border-color: rgba(124,58,237,0.2); }
  .sec-actions .row { border-color: rgba(124,58,237,0.1); }

  /* Financial */
  .sec-financial .section-hdr { background: rgba(22,163,74,0.10) !important; color: #14532d; border-color: rgba(22,163,74,0.25); }
  .sec-financial .section-body { border-color: rgba(22,163,74,0.2); }
  .sec-financial .row { border-color: rgba(22,163,74,0.08); }

  /* Operational */
  .sec-operational .section-hdr { background: rgba(245,158,11,0.10) !important; color: #78350f; border-color: rgba(245,158,11,0.3); }
  .sec-operational .section-body { border-color: rgba(245,158,11,0.25); }
  .sec-operational .row { border-color: rgba(245,158,11,0.1); }

  /* Strategic (non-financial) */
  .sec-strategic .section-hdr { background: rgba(37,99,235,0.08) !important; color: #1e3a8a; border-color: rgba(37,99,235,0.22); }
  .sec-strategic .section-body { border-color: rgba(37,99,235,0.2); }
  .sec-strategic .row { border-color: rgba(37,99,235,0.08); }

  /* Opportunities */
  .sec-opportunities .section-hdr { background: rgba(5,150,105,0.08) !important; color: #064e3b; border-color: rgba(5,150,105,0.22); }
  .sec-opportunities .section-body { border-color: rgba(5,150,105,0.2); }
  .sec-opportunities .row { border-color: rgba(5,150,105,0.08); }

  /* Biases */
  .sec-biases .section-hdr { background: rgba(245,158,11,0.10) !important; color: #78350f; border-color: rgba(245,158,11,0.28); }
  .sec-biases .section-body { border-color: rgba(245,158,11,0.22); }
  .sec-biases .row { border-color: rgba(245,158,11,0.08); }

  /* Tags */
  .tag {
    display: inline-block; font-size: 7.5pt; font-weight: 700;
    padding: 1px 7px; border-radius: 999px; text-transform: capitalize;
  }
  .tag-critical { background: rgba(220,38,38,0.12) !important; color: #b91c1c; }
  .tag-high     { background: rgba(245,158,11,0.12) !important; color: #b45309; }
  .tag-medium   { background: rgba(37,99,235,0.10) !important; color: #1d4ed8; }
  .tag-low      { background: rgba(15,23,42,0.07)  !important; color: #475569; }
  .tag-manual   { background: rgba(15,23,42,0.07)  !important; color: #475569; }
  .tag-ai       { background: rgba(124,58,237,0.10) !important; color: #7c3aed; }

  /* Conflict pair */
  .conflict-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .conflict-side { padding: 8px 10px; border-radius: 6px; font-size: 9pt; }
  .cs-a { background: rgba(37,99,235,0.06) !important; border: 1px solid rgba(37,99,235,0.14); }
  .cs-b { background: rgba(220,38,38,0.05) !important; border: 1px solid rgba(220,38,38,0.14); }
  .ca-a { font-size: 7.5pt; font-weight: 700; color: #1d4ed8; margin-bottom: 3px; }
  .ca-b { font-size: 7.5pt; font-weight: 700; color: #b91c1c; margin-bottom: 3px; }

  /* In-flow document footer — always at the natural end of content, never overlapping */
  .doc-footer {
    margin-top: 36px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 7.5pt; color: #94a3b8;
    display: flex; justify-content: space-between; align-items: center;
    page-break-inside: avoid; break-inside: avoid;
  }
  .doc-footer-ad {
    font-size: 7pt; font-weight: 700; color: #94a3b8;
    letter-spacing: 0.04em; text-align: center;
  }

  /* ── Topic banner ── */
  .topic-banner {
    display: flex; align-items: flex-start; gap: 12px;
    background: rgba(30,58,95,0.05) !important;
    border-left: 3px solid #1e3a5f;
    border-radius: 0 8px 8px 0;
    padding: 10px 14px;
    margin-bottom: 22px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .topic-banner-label {
    font-size: 7pt; font-weight: 700; letter-spacing: 0.09em;
    text-transform: uppercase; color: #64748b;
    white-space: nowrap; padding-top: 2px;
  }
  .topic-banner-text {
    font-size: 11pt; font-weight: 800; color: #0f172a; line-height: 1.35;
  }

  /* ── Chat ── */
  .msg { margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
  .msg-user { display: flex; flex-direction: column; align-items: flex-end; }
  .msg-user .bubble { background: #1e3a5f !important; color: #fff; border-radius: 14px 14px 2px 14px; padding: 9px 13px; max-width: 78%; font-size: 10pt; }
  .msg-user .meta { font-size: 7pt; color: #94a3b8; margin-top: 2px; text-align: right; }
  .msg-agent { display: flex; gap: 10px; align-items: flex-start; max-width: 84%; }
  .agent-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12pt; flex-shrink: 0; }
  .agent-name { font-size: 7.5pt; font-weight: 700; margin-bottom: 2px; }
  .agent-bubble { border-radius: 2px 14px 14px 14px; padding: 9px 13px; font-size: 10pt; }
  .role-strategic_analyst .agent-name { color: #1d4ed8; }
  .role-strategic_analyst .agent-bubble { background: rgba(37,99,235,0.07) !important; border: 1px solid rgba(37,99,235,0.15); }
  .role-devils_advocate .agent-name { color: #b91c1c; }
  .role-devils_advocate .agent-bubble { background: rgba(220,38,38,0.07) !important; border: 1px solid rgba(220,38,38,0.15); }
  .role-innovation_scout .agent-name { color: #065f46; }
  .role-innovation_scout .agent-bubble { background: rgba(16,185,129,0.07) !important; border: 1px solid rgba(16,185,129,0.18); }
  .role-other .agent-name { color: #475569; }
  .role-other .agent-bubble { background: #f8fafc !important; border: 1px solid #e2e8f0; }

  /* ── Board Brief ── */
  .bb-score-ring { display: flex; align-items: center; gap: 18px; margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid; }
  .bb-score-info { flex: 1; }
  .bb-score-title { font-size: 20pt; font-weight: 900; color: #0f172a; }
  .bb-score-sub { font-size: 9pt; color: #64748b; margin-top: 2px; margin-bottom: 6px; }
  .bb-score-rationale { font-size: 9.5pt; color: #475569; line-height: 1.6; }
  .bb-section { margin-bottom: 20px; }
  .bb-section-title {
    font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    color: #64748b; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1.5px solid #e2e8f0;
    page-break-after: avoid; break-after: avoid;
  }
  .bb-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; break-inside: avoid; }
  .bb-num { font-size: 8.5pt; font-weight: 700; color: #94a3b8; min-width: 18px; flex-shrink: 0; margin-top: 1px; }
  .bb-text { font-size: 10pt; color: #1e293b; line-height: 1.5; flex: 1; }
  .bb-badge { font-size: 7pt; font-weight: 700; padding: 1px 7px; border-radius: 999px; flex-shrink: 0; margin-top: 2px; text-transform: capitalize; }
  .bb-priority-critical { background: rgba(220,38,38,0.12) !important; color: #b91c1c; }
  .bb-priority-high     { background: rgba(245,158,11,0.12) !important; color: #b45309; }
  .bb-priority-medium   { background: rgba(37,99,235,0.10) !important; color: #1d4ed8; }
  .bb-priority-low      { background: rgba(15,23,42,0.07)  !important; color: #475569; }
  .bb-sev-critical { background: rgba(220,38,38,0.12) !important; color: #b91c1c; }
  .bb-sev-high     { background: rgba(245,158,11,0.12) !important; color: #b45309; }
  .bb-sev-medium   { background: rgba(37,99,235,0.10) !important; color: #1d4ed8; }
  .bb-sev-low      { background: rgba(15,23,42,0.07)  !important; color: #475569; }
`;

// ─── Logo HTML ────────────────────────────────────────────────────────────────

const LOGO_HTML = `
  <div class="logo-wrap">
    <div class="logo-box"><div class="logo-dot"></div></div>
    <span class="logo-text">Poddle</span>
  </div>
`;

// ─── Full document wrapper ────────────────────────────────────────────────────

function wrapDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="print-toolbar">
    <span class="print-toolbar-title">${escapeHtml(title)}</span>
    <a class="btn-close" href="javascript:window.close()">&#x2190; Back</a>
    <button class="btn-print" onclick="window.print()">&#x1F5A8;&nbsp; Print / Save PDF</button>
  </div>
  ${bodyHtml}
  <script>
    // Close button: prefer history.back() so PWA/installed apps return to the previous view.
    // Falls back to window.close() if there is no history entry to go back to.
    document.querySelector('.btn-close').addEventListener('click', function(e) {
      e.preventDefault();
      if (window.history.length > 1) { window.history.back(); }
      else { window.close(); }
    });
  </script>
</body>
</html>`;
}

// ─── Print Window ─────────────────────────────────────────────────────────────

function openPrintWindow(bodyHtml: string, title: string) {
  const html = wrapDocument(bodyHtml, title);

  // Prefer a new tab (full browser chrome, Back button works natively).
  // In PWA/standalone mode window.open may return null; fall back to iframe.
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  // PWA fallback: render into a full-viewport iframe injected into the current page.
  // The "Back" button in the toolbar calls history.back() which dismisses the iframe overlay.
  const overlay = document.createElement('div');
  overlay.id = 'pdf-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:0;';
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  // Push a history entry so the Back gesture / button removes the overlay.
  history.pushState({ pdfPreview: true }, '', location.href);
  const popHandler = () => {
    try { document.body.removeChild(overlay); } catch {}
    window.removeEventListener('popstate', popHandler);
  };
  window.addEventListener('popstate', popHandler);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wire the close button inside the iframe to pop history instead of closing.
  const wireClose = () => {
    const btn = iframe.contentDocument?.querySelector('.btn-close') as HTMLElement | null;
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        history.back();
      });
    }
  };
  if (iframe.contentDocument?.readyState === 'complete') wireClose();
  else iframe.onload = wireClose;
}

function pageChrome(_subtitle: string): string {
  return '';
}

// ─── Chat Export ─────────────────────────────────────────────────────────────

function topicBannerHtml(topic: string | undefined): string {
  if (!topic?.trim()) return '';
  return `<div class="topic-banner">
    <span class="topic-banner-label">Topic</span>
    <span class="topic-banner-text">${escapeHtml(topic)}</span>
  </div>`;
}

export function exportChatToPDF(messages: ChatMessageExport[], workspaceName: string, topic?: string) {
  const ICONS: Record<string, string> = {
    strategic_analyst: '&#x1F4CA;',
    devils_advocate: '&#x2694;&#xFE0F;',
    innovation_scout: '&#x1F52D;',
  };
  const rows = messages.map(m => {
    if (m.role === 'user') return `
      <div class="msg"><div class="msg-user">
        <div class="bubble">${escapeHtml(m.content)}</div>
        <div class="meta">${formatDate(m.created_at)}</div>
      </div></div>`;
    const role = m.agent_role || 'other';
    return `
      <div class="msg"><div class="msg-agent role-${role}">
        <div class="agent-icon">${ICONS[role] || '&#x1F916;'}</div>
        <div>
          <div class="agent-name">${escapeHtml(m.agent_name || 'AI Agent')}</div>
          <div class="agent-bubble">${escapeHtml(m.content)}</div>
        </div>
      </div></div>`;
  }).join('');

  const html = `<div class="print-root">
    ${pageChrome('AI Collaboration')}
    <div class="doc-header">
      <div class="doc-header-top">
        <div>
          <div class="brand">Poddle · AI Collaboration</div>
          <div class="title">${escapeHtml(workspaceName)}</div>
          <div class="subtitle">Discussion Transcript</div>
        </div>
        <div class="meta-right">Exported ${formatDate(new Date().toISOString())}<br>${messages.length} message${messages.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    ${topicBannerHtml(topic)}
    ${rows}
    <div class="doc-footer">
      <span>Poddle, Inc. — AI-Powered Strategic Intelligence</span>
      <span class="doc-footer-ad">poddleme.com</span>
      <span>Confidential · ${formatDate(new Date().toISOString())}</span>
    </div>
  </div>`;
  openPrintWindow(html, `${workspaceName} — Discussion`);
}

// ─── War Room Full Export ─────────────────────────────────────────────────────

export function exportWarRoomToPDF(data: WarRoomExport) {
  const sc = scoreColor(data.decisionHealthScore);
  const sl = scoreLabel(data.decisionHealthScore);

  function subScoreBar(label: string, score: number | null | undefined): string {
    if (score == null) return '';
    const c = scoreColor(score);
    const W = 80, H = 6, r = 3;
    const fillW = Math.max(r * 2, (score / 100) * W);
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
      <span style="font-size:7pt;color:#94a3b8;min-width:90px;">${label}</span>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="rgba(255,255,255,0.12)"/>
        <rect x="0" y="0" width="${fillW.toFixed(1)}" height="${H}" rx="${r}" fill="${c}"/>
      </svg>
      <span style="font-size:7.5pt;font-weight:800;color:${c};">${score}</span>
    </div>`;
  }

  function velocityBadge(v: string | null | undefined): string {
    if (!v) return '';
    const map: Record<string, { color: string; bg: string }> = {
      fast:     { color: '#15803d', bg: 'rgba(22,163,74,0.15)' },
      moderate: { color: '#b45309', bg: 'rgba(245,158,11,0.15)' },
      stalling: { color: '#b91c1c', bg: 'rgba(220,38,38,0.15)' },
    };
    const s = map[v.toLowerCase()] || map.moderate;
    return `<span style="display:inline-block;font-size:7pt;font-weight:700;padding:2px 8px;border-radius:999px;background:${s.bg};color:${s.color};margin-left:6px;">${v.charAt(0).toUpperCase() + v.slice(1)} Velocity</span>`;
  }

  function trajectoryBadge(t: string | null | undefined): string {
    if (!t) return '';
    const map: Record<string, { color: string; bg: string }> = {
      rising:  { color: '#15803d', bg: 'rgba(22,163,74,0.15)' },
      flat:    { color: '#b45309', bg: 'rgba(245,158,11,0.15)' },
      falling: { color: '#b91c1c', bg: 'rgba(220,38,38,0.15)' },
    };
    const s = map[t.toLowerCase()] || map.flat;
    const label = t === 'rising' ? 'Confidence Rising' : t === 'falling' ? 'Confidence Falling' : 'Confidence Flat';
    return `<span style="display:inline-block;font-size:7pt;font-weight:700;padding:2px 8px;border-radius:999px;background:${s.bg};color:${s.color};margin-left:6px;">${label}</span>`;
  }

  function sec(cls: string, title: string, icon: string, rows: string[]): string {
    if (!rows.length) return '';
    return `<div class="section sec-${cls}">
      <div class="section-hdr">${icon}&nbsp; ${title}</div>
      <div class="section-body">${rows.join('')}</div>
    </div>`;
  }

  const confColor = (c: string) => c === 'high' ? '#15803d' : c === 'low' ? '#b91c1c' : '#b45309';
  const confBg    = (c: string) => c === 'high' ? 'rgba(22,163,74,0.12)' : c === 'low' ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)';
  const opStatusColor = (s: string) => ['clear','on-track'].includes(s) ? '#15803d' : s === 'at-risk' ? '#b91c1c' : '#b45309';
  const opStatusBg    = (s: string) => ['clear','on-track'].includes(s) ? 'rgba(22,163,74,0.12)' : s === 'at-risk' ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)';
  const sigColor = (s: string) => s === 'positive' ? '#15803d' : s === 'negative' ? '#b91c1c' : '#475569';
  const sigBg    = (s: string) => s === 'positive' ? 'rgba(22,163,74,0.12)' : s === 'negative' ? 'rgba(220,38,38,0.12)' : 'rgba(100,116,139,0.12)';

  // ── Consensus with SVG bars ──
  const consensusRows = data.consensusPoints.map((pt, i) => {
    const conf = Math.max(0, Math.min(100, pt.confidence || 0));
    const c = conf >= 80 ? '#16a34a' : conf >= 60 ? '#84cc16' : '#f59e0b';
    return `<div class="row">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:8pt;font-weight:700;color:#14532d;min-width:16px;flex-shrink:0;">${i + 1}.</span>
        <div style="flex:1;">
          <div style="margin-bottom:6px;">${escapeHtml(pt.text)}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${svgConsensusBar(conf, c)}
            <span style="font-size:7.5pt;font-weight:700;color:${c};">${conf}%</span>
            <span style="font-size:7.5pt;color:#64748b;">${pt.source_count} agreed</span>
          </div>
        </div>
      </div>
    </div>`;
  });

  // ── Conflict zones with SVG tension bars ──
  const conflictRows = data.conflictZones.map(z => {
    const lvl = Math.max(0, Math.min(100, z.tension_level || 0));
    return `<div class="row">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <strong style="font-size:9.5pt;">${escapeHtml(z.topic)}</strong>
        ${svgTensionBar(lvl)}
        <span style="font-size:7.5pt;font-weight:700;color:${lvl >= 70 ? '#b91c1c' : lvl >= 45 ? '#b45309' : '#1d4ed8'};">${lvl}/100</span>
      </div>
      <div class="conflict-pair">
        <div class="conflict-side cs-a">
          <div class="ca-a">${escapeHtml(z.agent_a)}</div>
          <div style="font-size:9pt;">${escapeHtml(z.position_a)}</div>
        </div>
        <div class="conflict-side cs-b">
          <div class="ca-b">${escapeHtml(z.agent_b)}</div>
          <div style="font-size:9pt;">${escapeHtml(z.position_b)}</div>
        </div>
      </div>
    </div>`;
  });

  // ── Open questions ──
  const questionRows = data.openQuestions.map(q => `
    <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
      <span class="tag tag-${q.urgency?.toLowerCase()}">${escapeHtml(q.urgency)}</span>
      <span>${escapeHtml(q.question)}</span>
    </div>`);

  // ── Risk signals — list + SVG matrix ──
  const riskRows = data.riskSignals.length > 0 ? [
    // SVG matrix first
    `<div class="row" style="padding:16px 14px 8px;">
      <div style="font-size:7.5pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Severity &times; Category Matrix</div>
      ${svgRiskMatrix(data.riskSignals)}
    </div>`,
    // Then numbered list
    ...data.riskSignals.map((r, i) => `
      <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:20px;height:20px;border-radius:50%;background:${severityColor(r.severity)};flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:8pt;font-weight:900;color:#fff;">${i + 1}</span>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span class="tag tag-${r.severity?.toLowerCase()}">${escapeHtml(r.severity)}</span>
            <span style="font-size:7.5pt;color:#64748b;text-transform:capitalize;">${escapeHtml(r.category)}</span>
          </div>
          <span style="font-size:9.5pt;">${escapeHtml(r.signal)}</span>
        </div>
      </div>`)
  ] : [];

  // ── Blind spots ──
  const blindRows = data.blindSpots.map(bs => `
    <div class="row">
      <div style="font-size:10pt;font-weight:700;color:#0c4a6e;margin-bottom:2px;">${escapeHtml(bs.area)}</div>
      <div style="font-size:9.5pt;color:#475569;">${escapeHtml(bs.description)}</div>
    </div>`);

  // ── Action items ──
  const actionRows = (data.actionItems || []).map((a, i) => `
    <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:8.5pt;font-weight:700;color:#7c3aed;min-width:18px;flex-shrink:0;">${i + 1}.</span>
      <div style="flex:1;">
        <div style="font-size:9.5pt;${a.status === 'done' ? 'text-decoration:line-through;color:#94a3b8;' : 'color:#1e293b;'}margin-bottom:4px;">${escapeHtml(a.text)}</div>
        <div style="display:flex;gap:5px;align-items:center;">
          <span class="tag tag-${a.priority?.toLowerCase()}">${escapeHtml(a.priority)}</span>
          <span class="tag" style="background:rgba(15,23,42,0.07)!important;color:#475569;text-transform:capitalize;">${a.status.replace('_', ' ')}</span>
          ${a.source === 'ai' ? '<span class="tag" style="background:rgba(124,58,237,0.10)!important;color:#7c3aed;">AI</span>' : ''}
        </div>
      </div>
    </div>`);

  // ── Financial metrics ──
  const financialRows = (data.financialMetrics || []).map(m => `
    <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:9.5pt;font-weight:700;color:#14532d;">${escapeHtml(m.metric)}</span>
          <span style="font-size:7pt;font-weight:700;padding:1px 7px;border-radius:999px;background:${confBg(m.confidence?.toLowerCase())};color:${confColor(m.confidence?.toLowerCase())};">${escapeHtml(m.confidence)} confidence</span>
        </div>
        <div style="font-size:9.5pt;font-weight:600;color:#1e293b;margin-bottom:2px;">${escapeHtml(m.value)}</div>
        <div style="font-size:8.5pt;color:#64748b;">${escapeHtml(m.note)}</div>
      </div>
    </div>`);

  // ── Operational metrics ──
  const operationalRows = (data.operationalMetrics || []).map(m => `
    <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:9.5pt;font-weight:700;color:#78350f;">${escapeHtml(m.metric)}</span>
          <span style="font-size:7pt;font-weight:700;padding:1px 7px;border-radius:999px;text-transform:capitalize;background:${opStatusBg(m.status?.toLowerCase())};color:${opStatusColor(m.status?.toLowerCase())};">${escapeHtml(m.status?.replace('-', ' ') || '')}</span>
        </div>
        <div style="font-size:8.5pt;color:#64748b;">${escapeHtml(m.note)}</div>
      </div>
    </div>`);

  // ── Non-financial / strategic metrics ──
  const strategicRows = (data.nonFinancialMetrics || []).map(m => `
    <div class="row" style="display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:9.5pt;font-weight:700;color:#1e3a8a;">${escapeHtml(m.metric)}</span>
          <span style="font-size:7pt;font-weight:700;padding:1px 7px;border-radius:999px;text-transform:capitalize;background:${sigBg(m.signal?.toLowerCase())};color:${sigColor(m.signal?.toLowerCase())};">${escapeHtml(m.signal)}</span>
        </div>
        <div style="font-size:8.5pt;color:#64748b;">${escapeHtml(m.note)}</div>
      </div>
    </div>`);

  // ── Opportunity signals ──
  const opportunityRows = (data.opportunitySignals || []).map((o, i) => `
    <div class="row">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:8pt;font-weight:700;color:#064e3b;min-width:16px;flex-shrink:0;">${i + 1}.</span>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="font-size:9.5pt;font-weight:700;color:#064e3b;">${escapeHtml(o.title)}</span>
            <span style="font-size:7pt;font-weight:700;padding:1px 7px;border-radius:999px;background:${confBg(o.confidence?.toLowerCase())};color:${confColor(o.confidence?.toLowerCase())};">${escapeHtml(o.confidence)}</span>
          </div>
          <div style="font-size:9.5pt;color:#1e293b;margin-bottom:2px;">${escapeHtml(o.description)}</div>
          <div style="font-size:8pt;color:#94a3b8;font-style:italic;">Source: ${escapeHtml(o.source)}</div>
        </div>
      </div>
    </div>`);

  // ── Cognitive bias flags ──
  const biasRows = (data.cognitiveBiasFlags || []).map(f => `
    <div class="row">
      <div style="font-size:10pt;font-weight:800;color:#78350f;margin-bottom:3px;">${escapeHtml(f.bias_name)}</div>
      <div style="font-size:9pt;color:#475569;margin-bottom:6px;">${escapeHtml(f.explanation)}</div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:6px;padding:8px 10px;">
        <div style="font-size:7.5pt;font-weight:700;color:#b45309;margin-bottom:2px;">Counter-question</div>
        <div style="font-size:8.5pt;color:#78350f;font-style:italic;">"${escapeHtml(f.counter_question)}"</div>
      </div>
    </div>`);

  const html = `<div class="print-root">
    ${pageChrome('War Room')}
    <div class="doc-header">
      <div class="doc-header-top">
        <div>
          <div class="brand">Poddle · War Room Intelligence</div>
          <div class="title">${escapeHtml(data.workspaceName)}</div>
          <div class="subtitle">Strategic Intelligence Report</div>
        </div>
        <div class="meta-right">
          Generated ${formatDate(data.generatedAt)}<br>
          Based on ${data.messageCount} messages
        </div>
      </div>
    </div>
    ${topicBannerHtml(data.topic)}

    <div class="score-block">
      ${svgScoreRing(data.decisionHealthScore)}
      <div style="flex:1;">
        <div class="score-label" style="color:${sc};">${sl} Team</div>
        <div class="score-sub">Decision Health Score: ${data.decisionHealthScore} / 100</div>
        <div class="score-rationale">${escapeHtml(data.healthRationale || 'AI-assessed clarity, risk coverage, and strategic alignment.')}</div>
        <div style="margin-top:8px;">
          ${subScoreBar('Financial Clarity', data.financialScore)}
          ${subScoreBar('Operational Readiness', data.operationalScore)}
          ${subScoreBar('Strategic Alignment', data.alignmentScore)}
        </div>
        ${data.decisionVelocity || data.confidenceTrajectory ? `<div style="margin-top:8px;">${velocityBadge(data.decisionVelocity)}${trajectoryBadge(data.confidenceTrajectory)}</div>` : ''}
      </div>
    </div>

    ${sec('consensus',    'Team Consensus',          '&#x2713;',  consensusRows)}
    ${sec('conflicts',    'Strategic Conflict Zones', '&#x26A1;',  conflictRows)}
    ${sec('questions',    'Open Questions',           '?',         questionRows)}
    ${sec('risks',        'Risk Signals',             '&#x26A0;',  riskRows)}
    ${sec('blindspots',   'Blind Spots',              '&#x25CE;',  blindRows)}
    ${sec('financial',    'Financial Metrics',        '&#x24C2;',  financialRows)}
    ${sec('operational',  'Operational Readiness',   '&#x2699;',  operationalRows)}
    ${sec('strategic',    'Strategic & Non-Financial','&#x25A0;',  strategicRows)}
    ${sec('opportunities','Opportunity Signals',      '&#x2B50;',  opportunityRows)}
    ${sec('biases',       'Cognitive Bias Flags',     '&#x26A0;',  biasRows)}
    ${actionRows.length ? sec('actions', 'Action Items', '&#x25B6;', actionRows) : ''}

    <div class="doc-footer">
      <span>Poddle, Inc. — AI-Powered Strategic Intelligence</span>
      <span class="doc-footer-ad">poddleme.com</span>
      <span>Confidential · Exported ${formatDate(new Date().toISOString())}</span>
    </div>
  </div>`;

  openPrintWindow(html, `${data.workspaceName} — War Room Report`);
}

// ─── Board Brief Export ───────────────────────────────────────────────────────

export function exportBoardBriefToPDF(data: BoardBriefExport) {
  const sc = scoreColor(data.decisionHealthScore);
  const sl = scoreLabel(data.decisionHealthScore);
  const pendingActions = data.actionItems
    .filter(a => a.status !== 'done')
    .sort((a, b) => {
      const o = ['critical', 'high', 'medium', 'low'];
      return o.indexOf(a.priority?.toLowerCase()) - o.indexOf(b.priority?.toLowerCase());
    })
    .slice(0, 5);

  function bbSubScore(label: string, score: number | null | undefined): string {
    if (score == null) return '';
    const c = scoreColor(score);
    const W = 70, H = 5, r = 2;
    const fillW = Math.max(r * 2, (score / 100) * W);
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
      <span style="font-size:7pt;color:#94a3b8;min-width:85px;">${label}</span>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="#e2e8f0"/>
        <rect x="0" y="0" width="${fillW.toFixed(1)}" height="${H}" rx="${r}" fill="${c}"/>
      </svg>
      <span style="font-size:7.5pt;font-weight:800;color:${c};">${score}</span>
    </div>`;
  }

  const confColor = (c: string) => c === 'high' ? '#15803d' : c === 'low' ? '#b91c1c' : '#b45309';
  const confBg    = (c: string) => c === 'high' ? 'rgba(22,163,74,0.12)' : c === 'low' ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)';

  const consensusHtml = data.consensusPoints.slice(0, 3).map((p, i) => {
    const conf = Math.max(0, Math.min(100, p.confidence || 0));
    const c = conf >= 80 ? '#16a34a' : conf >= 60 ? '#84cc16' : '#f59e0b';
    return `<div class="bb-row">
      <span class="bb-num">${i + 1}.</span>
      <div style="flex:1;">
        <div class="bb-text" style="margin-bottom:5px;">${escapeHtml(p.text)}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${svgConsensusBar(conf, c)}
          <span style="font-size:7.5pt;font-weight:700;color:${c};">${conf}%</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const risksHtml = data.riskSignals.slice(0, 3).map((r, i) => `
    <div class="bb-row">
      <span class="bb-num">${i + 1}.</span>
      <div class="bb-text">${escapeHtml(r.signal)}</div>
      <span class="bb-badge bb-sev-${r.severity?.toLowerCase()}">${escapeHtml(r.severity)}</span>
    </div>`).join('');

  const actionsHtml = pendingActions.map((a, i) => `
    <div class="bb-row">
      <span class="bb-num">${i + 1}.</span>
      <div class="bb-text">${escapeHtml(a.text)}</div>
      <span class="bb-badge bb-priority-${a.priority?.toLowerCase()}">${escapeHtml(a.priority)}</span>
    </div>`).join('');

  const opportunitiesHtml = (data.opportunitySignals || []).slice(0, 3).map((o, i) => `
    <div class="bb-row">
      <span class="bb-num">${i + 1}.</span>
      <div style="flex:1;">
        <div style="font-size:9.5pt;font-weight:700;color:#064e3b;margin-bottom:2px;">${escapeHtml(o.title)}</div>
        <div class="bb-text" style="font-size:9pt;">${escapeHtml(o.description)}</div>
      </div>
      <span style="font-size:7pt;font-weight:700;padding:1px 7px;border-radius:999px;flex-shrink:0;background:${confBg(o.confidence?.toLowerCase())};color:${confColor(o.confidence?.toLowerCase())};">${escapeHtml(o.confidence)}</span>
    </div>`).join('');

  const runBadge = data.synthesisRunNumber ? `<span style="font-size:7.5pt;font-weight:600;color:#94a3b8;margin-left:10px;">Run #${data.synthesisRunNumber}</span>` : '';

  const html = `<div class="print-root">
    ${pageChrome('Board Brief')}
    <div class="doc-header">
      <div class="doc-header-top">
        <div>
          <div class="brand">Poddle · War Room</div>
          <div class="title">${escapeHtml(data.workspaceName)}</div>
          <div class="subtitle">Board-Ready Brief</div>
        </div>
        <div class="meta-right">
          Generated ${formatDate(data.generatedAt)}<br>
          ${formatDate(new Date().toISOString())} export
        </div>
      </div>
    </div>
    ${topicBannerHtml(data.topic)}

    <div class="bb-score-ring">
      ${svgScoreRing(data.decisionHealthScore)}
      <div class="bb-score-info">
        <div class="bb-score-title" style="color:${sc};">${sl} Team ${runBadge}</div>
        <div class="bb-score-sub">Decision Health Score: ${data.decisionHealthScore} / 100</div>
        <div class="bb-score-rationale">${escapeHtml(data.healthRationale || 'AI-assessed strategic clarity and decision quality.')}</div>
        <div style="margin-top:6px;">
          ${bbSubScore('Financial Clarity', data.financialScore)}
          ${bbSubScore('Operational Readiness', data.operationalScore)}
          ${bbSubScore('Strategic Alignment', data.alignmentScore)}
        </div>
      </div>
    </div>

    ${data.consensusPoints.length > 0 ? `
    <div class="bb-section">
      <div class="bb-section-title">Team Consensus</div>
      ${consensusHtml}
    </div>` : ''}

    ${data.riskSignals.length > 0 ? `
    <div class="bb-section">
      <div class="bb-section-title">Key Risks</div>
      ${risksHtml}
    </div>` : ''}

    ${opportunitiesHtml ? `
    <div class="bb-section">
      <div class="bb-section-title">Opportunity Signals</div>
      ${opportunitiesHtml}
    </div>` : ''}

    ${pendingActions.length > 0 ? `
    <div class="bb-section">
      <div class="bb-section-title">Priority Actions</div>
      ${actionsHtml}
    </div>` : ''}

    <div class="doc-footer">
      <span>Poddle, Inc. — AI-Powered Strategic Intelligence</span>
      <span class="doc-footer-ad">poddleme.com</span>
      <span>Confidential · ${formatDate(new Date().toISOString())}</span>
    </div>
  </div>`;

  openPrintWindow(html, `${data.workspaceName} — Board Brief`);
}
