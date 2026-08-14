interface PoddleMarkProps {
  size?: number;
  className?: string;
}

export default function PoddleMark({ size = 36, className = '' }: PoddleMarkProps) {
  return (
    <img
      src="/images/logos/poddle-mark.png"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      alt=""
      aria-hidden="true"
    />
  );
}
