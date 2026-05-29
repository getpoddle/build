/**
 * Returns a throttled version of `fn` that fires at most once per `ms`.
 * The first call fires immediately; subsequent calls within the window are
 * dropped. After the window expires the next call fires immediately again.
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      return fn.apply(this, args);
    }
  } as T;
}

/**
 * Returns a debounced version of `fn` that fires `ms` after the last call.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  } as T & { cancel: () => void };
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  return debounced;
}
