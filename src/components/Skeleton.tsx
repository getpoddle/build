interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-100 ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(15,23,42,0.07)',
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      }}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonFeedList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPodCard() {
  return (
    <div
      className="rounded-2xl p-4 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(15,23,42,0.07)',
        boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      }}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
            <Skeleton className="w-16 h-6 rounded-full flex-shrink-0 ml-2" />
          </div>
          <Skeleton className="h-3 w-full rounded" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-5 w-16 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonPodList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPodCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonThreadCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(15,23,42,0.07)',
        boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
      }}
    >
      <div className="h-0.5 w-full bg-slate-100" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-xl" />
          <Skeleton className="h-6 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-18 rounded" />
          </div>
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonThreadList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonThreadCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonNotification() {
  return (
    <div className="p-4 flex items-start gap-3">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0 mt-1" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
