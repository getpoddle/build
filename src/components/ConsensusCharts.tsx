export interface ChartData {
  agent_confidence: Array<{ agent_name: string; confidence: number }>;
  risk_distribution: Array<{ category: string; count: number }>;
  alignment_scores: Array<{ dimension: string; score: number }>;
}

export interface AgentFigures {
  figures: Array<{ label: string; value: number; unit: string }>;
  categories: Array<{ label: string; value: number; unit: string }>;
}

const RISK_COLORS: Record<string, string> = {
  Market: '#0ea5e9',
  Execution: '#f59e0b',
  Financial: '#ef4444',
  Technology: '#8b5cf6',
  People: '#10b981',
  Regulatory: '#64748b',
};

const CONFIDENCE_COLOR = (v: number) =>
  v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444';

const ALIGNMENT_COLOR = (v: number) =>
  v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444';

const FIGURE_COLOR = '#0ea5e9';
const CATEGORY_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b', '#ec4899', '#14b8a6'];

function AgentConfidenceChart({ data }: { data: Array<{ agent_name: string; confidence: number }> }) {
  const barHeight = 28;
  const gap = 10;
  const labelWidth = 120;
  const trackWidth = 180;
  const height = data.length * (barHeight + gap) + 20;
  const width = labelWidth + trackWidth + 50;

  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Agent Confidence</h4>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="block w-full" style={{ maxWidth: `${width}px`, width: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }}>
        {data.map((item, i) => {
          const y = i * (barHeight + gap);
          const barW = Math.max(2, (item.confidence / 100) * trackWidth);
          return (
            <g key={i}>
              <text x={0} y={y + barHeight / 2 + 4} className="fill-slate-600" style={{ font: '12px ui-sans-serif, system-ui', fontWeight: 500 }}>
                {item.agent_name.length > 16 ? item.agent_name.slice(0, 15) + '…' : item.agent_name}
              </text>
              <rect x={labelWidth} y={y} width={trackWidth} height={barHeight} rx={4} className="fill-slate-100" />
              <rect x={labelWidth} y={y} width={barW} height={barHeight} rx={4} fill={CONFIDENCE_COLOR(item.confidence)} />
              <text x={labelWidth + trackWidth + 8} y={y + barHeight / 2 + 4} className="fill-slate-700" style={{ font: 'bold 12px ui-sans-serif, system-ui' }}>
                {Math.round(item.confidence)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RiskDonutChart({ data }: { data: Array<{ category: string; count: number }> }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const size = 180;
  const radius = 70;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 28;

  if (total === 0) {
    return (
      <div className="min-w-0">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Risk Distribution</h4>
        <p className="text-sm text-slate-400 italic">No risks identified</p>
      </div>
    );
  }

  let cumulative = 0;
  const segments = data.filter(d => d.count > 0).map((d) => {
    const fraction = d.count / total;
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.count;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    return { path, color: RISK_COLORS[d.category] || '#94a3b8', category: d.category, count: d.count, fraction };
  });

  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Risk Distribution</h4>
      <div className="flex flex-wrap items-start gap-3 sm:gap-5">
        <svg viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" style={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1', height: 'auto' }}>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="butt" />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-800" style={{ font: 'bold 28px ui-sans-serif, system-ui' }}>
            {total}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400" style={{ font: '11px ui-sans-serif, system-ui' }}>
            risks
          </text>
        </svg>
        <div className="flex flex-col gap-1.5 pt-1 min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-slate-600 truncate">{seg.category}</span>
              <span className="text-xs font-semibold text-slate-800 flex-shrink-0">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlignmentHistogram({ data }: { data: Array<{ dimension: string; score: number }> }) {
  const barWidth = 36;
  const gap = 16;
  const chartHeight = 120;
  const baseline = chartHeight - 20;
  const width = data.length * (barWidth + gap) + 20;

  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Agent Alignment</h4>
      <svg viewBox={`0 0 ${width} ${chartHeight + 30}`} preserveAspectRatio="xMidYMid meet" className="block w-full" style={{ maxWidth: `${width}px`, width: '100%', height: 'auto', aspectRatio: `${width} / ${chartHeight + 30}` }}>
        <line x1={10} y1={baseline} x2={width - 10} y2={baseline} className="stroke-slate-200" strokeWidth={1} />
        {data.map((item, i) => {
          const x = 10 + i * (barWidth + gap);
          const barH = (item.score / 100) * (baseline - 10);
          const y = baseline - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={3} fill={ALIGNMENT_COLOR(item.score)} />
              <text x={x + barWidth / 2} y={baseline + 16} textAnchor="middle" className="fill-slate-500" style={{ font: '11px ui-sans-serif, system-ui' }}>
                {item.dimension}
              </text>
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="fill-slate-700" style={{ font: 'bold 11px ui-sans-serif, system-ui' }}>
                {Math.round(item.score)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FiguresChart({ data }: { data: Array<{ label: string; value: number; unit: string }> }) {
  if (data.length === 0) return null;
  const barHeight = 22;
  const gap = 8;
  const labelWidth = 140;
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const trackWidth = 140;
  const height = data.length * (barHeight + gap) + 20;
  const width = labelWidth + trackWidth + 60;

  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Figures</h4>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="block w-full" style={{ maxWidth: `${width}px`, width: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }}>
        {data.map((item, i) => {
          const y = i * (barHeight + gap);
          const barW = Math.max(2, (Math.abs(item.value) / maxVal) * trackWidth);
          const displayVal = item.unit === '$' ? `$${item.value.toLocaleString()}` : `${item.value}${item.unit ? item.unit : ''}`;
          return (
            <g key={i}>
              <text x={0} y={y + barHeight / 2 + 4} className="fill-slate-600" style={{ font: '11px ui-sans-serif, system-ui', fontWeight: 500 }}>
                {item.label.length > 18 ? item.label.slice(0, 17) + '…' : item.label}
              </text>
              <rect x={labelWidth} y={y} width={trackWidth} height={barHeight} rx={3} className="fill-slate-100" />
              <rect x={labelWidth} y={y} width={barW} height={barHeight} rx={3} fill={FIGURE_COLOR} />
              <text x={labelWidth + trackWidth + 8} y={y + barHeight / 2 + 4} className="fill-slate-700" style={{ font: 'bold 11px ui-sans-serif, system-ui' }}>
                {displayVal}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CategoriesChart({ data }: { data: Array<{ label: string; value: number; unit: string }> }) {
  if (data.length === 0) return null;
  const size = 150;
  const radius = 58;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 24;
  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);

  if (total === 0) return null;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const fraction = Math.abs(d.value) / total;
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += Math.abs(d.value);
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    return { path, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], label: d.label, value: d.value, unit: d.unit, fraction };
  });

  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Breakdown</h4>
      <div className="flex flex-wrap items-start gap-3">
        <svg viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" style={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1', height: 'auto' }}>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="butt" />
          ))}
        </svg>
        <div className="flex flex-col gap-1 pt-1 min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-slate-600 truncate">{seg.label}</span>
              <span className="text-xs font-semibold text-slate-800 flex-shrink-0">{seg.unit === '%' ? `${seg.value}%` : seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ConsensusChartsProps {
  data?: ChartData | null;
  figures?: AgentFigures | null;
}

export default function ConsensusCharts({ data, figures }: ConsensusChartsProps) {
  // Per-agent figures mode: render figure + category charts beneath agent text
  if (figures && !data) {
    if (!figures.figures?.length && !figures.categories?.length) return null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-200/70 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Figures & Breakdown</span>
        </div>
        <div className="flex flex-col gap-4">
          {figures.figures?.length > 0 && (
            <div className="overflow-x-auto -mx-1 px-1">
              <FiguresChart data={figures.figures} />
            </div>
          )}
          {figures.categories?.length > 0 && (
            <div className="overflow-x-auto -mx-1 px-1">
              <CategoriesChart data={figures.categories} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Consensus mode: render the three debate analytics charts
  if (!data) return null;
  if (!data.agent_confidence?.length && !data.alignment_scores?.length) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/70 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Debate Analytics</span>
      </div>
      <div className="flex flex-col gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {data.agent_confidence?.length > 0 && (
          <div className="overflow-x-auto -mx-1 px-1">
            <AgentConfidenceChart data={data.agent_confidence} />
          </div>
        )}
        {data.risk_distribution?.length > 0 && (
          <div className="overflow-x-auto -mx-1 px-1">
            <RiskDonutChart data={data.risk_distribution} />
          </div>
        )}
        {data.alignment_scores?.length > 0 && (
          <div className="overflow-x-auto -mx-1 px-1">
            <AlignmentHistogram data={data.alignment_scores} />
          </div>
        )}
      </div>
    </div>
  );
}
