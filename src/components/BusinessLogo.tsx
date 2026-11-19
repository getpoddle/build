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
  const [showMobile, setShowMobile] = useState(false);
  const tooltipId = `business-tooltip-${id}`;
  return (
    <div className="group relative flex flex-col items-center justify-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${name} website`}
        aria-describedby={tooltipId}
        className="inline-flex items-center justify-center opacity-80 transition-all duration-200 hover:opacity-100 hover:-translate-y-0.5 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
      >
        <img src={image} alt={`${name} logo`} width={width} height={height} loading="lazy" className="h-10 w-auto object-contain" />
      </a>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 hidden w-64 max-w-[85vw] -translate-x-1/2 translate-y-1 rounded-xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 md:block"
      >
        <p className="mb-1 text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs leading-relaxed text-slate-600">{descriptions[id]}</p>
      </div>
      <button
        type="button"
        className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-blue-600 underline underline-offset-2 md:hidden"
        aria-expanded={showMobile}
        aria-controls={`business-mobile-${id}`}
        onClick={() => setShowMobile(v => !v)}
      >
        {showMobile ? 'Hide details' : 'About'}
      </button>
      {showMobile && (
        <p id={`business-mobile-${id}`} className="mt-2 w-44 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-700 shadow-sm md:hidden">
          {descriptions[id]}
        </p>
      )}
    </div>
  );
}
