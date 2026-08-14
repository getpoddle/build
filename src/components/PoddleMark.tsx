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
      <path d="M8 40 49 12l9 14-27 18 27 18-9 14L8 48V40Z" fill="#0B4AA2" />
      <path d="m92 40-41-28-9 14 27 18-27 18 9 14 41-28v-8Z" fill="#C7A95F" />
      <path d="m43 50 9-13 9 13-9 13-9-13Z" fill="#0B4AA2" />
      <path d="m39 50 9-13 9 13-9 13-9-13Z" fill="#C7A95F" />
    </svg>
  );
}
