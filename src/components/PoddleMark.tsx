interface PoddleMarkProps {
  size?: number;
  className?: string;
}

export default function PoddleMark({ size = 36, className = '' }: PoddleMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Top-right large bubble */}
      <ellipse cx="60" cy="28" rx="26" ry="24" fill="#2563eb" />
      <polygon points="52,48 44,62 62,48" fill="#2563eb" />

      {/* Left medium bubble */}
      <ellipse cx="34" cy="46" rx="22" ry="20" fill="#3b82f6" />
      <polygon points="26,62 20,74 40,62" fill="#3b82f6" />

      {/* Bottom-right small bubble */}
      <ellipse cx="64" cy="64" rx="17" ry="15" fill="#60a5fa" />
      <polygon points="58,76 54,86 68,76" fill="#60a5fa" />
    </svg>
  );
}
