import { useState } from 'react';

const descriptions: Record<string, string> = {
  kallotok: 'Uses Poddle AI to evaluate product strategy, creator monetization models, and platform governance decisions.',
  intelnet: 'Uses Poddle AI to challenge assumptions, evaluate risk intelligence strategies, and prioritize product development decisions.',
  'atlantic-review': 'Uses Poddle AI to assess editorial priorities, evaluate policy research directions, and support evidence-backed strategic decisions.',
};

interface BusinessLogoProps {
  id: 'kallotok' | 'intelnet' | 'atlantic-review';
  name: string;
  href: string;
  image: string;
  width: number;
  height: number;
}

export default function BusinessLogo({ id, name, href, image, width, height }: BusinessLogoProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const visible = hovered || focused || expanded;
  const tooltipId = `business-tooltip-${id}`;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ isolation: 'isolate' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${name} website`}
        aria-describedby={tooltipId}
        className="inline-flex items-center justify-center opacity-80 transition-all duration-200 hover:opacity-100 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
      >
        <img src={image} alt={`${name} logo`} width={width} height={height} loading="lazy" className="h-10 w-auto object-contain" />
      </a>

      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={!visible}
        style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${visible ? '0' : '-5px'})`,
          width: 'min(260px, 80vw)',
          padding: '14px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#ffffff',
          color: '#334155',
          boxShadow: '0 12px 30px rgba(15,23,42,0.16)',
          zIndex: 100,
          textAlign: 'left',
          opacity: visible ? 1 : 0,
          visibility: visible ? 'visible' : 'hidden',
          pointerEvents: 'none',
          transition: 'opacity 180ms ease, transform 180ms ease, visibility 180ms ease',
        }}
      >
        <p className="mb-1 text-sm font-semibold" style={{ color: '#0f172a' }}>{name}</p>
        <p className="text-xs leading-relaxed">{descriptions[id]}</p>
      </div>

      <button
        type="button"
        className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-blue-600 underline underline-offset-2 md:hidden"
        aria-expanded={expanded}
        aria-controls={tooltipId}
        onClick={() => setExpanded(value => !value)}
      >
        {expanded ? 'Hide details' : 'About'}
      </button>
    </div>
  );
}
