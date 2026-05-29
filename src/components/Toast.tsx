import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: {
    bg: 'rgba(240,253,244,0.98)',
    border: '#bbf7d0',
    icon: '#16a34a',
    text: '#14532d',
  },
  error: {
    bg: 'rgba(255,241,242,0.98)',
    border: '#fecaca',
    icon: '#dc2626',
    text: '#7f1d1d',
  },
  warning: {
    bg: 'rgba(255,251,235,0.98)',
    border: '#fde68a',
    icon: '#d97706',
    text: '#78350f',
  },
  info: {
    bg: 'rgba(239,246,255,0.98)',
    border: '#bfdbfe',
    icon: '#2563eb',
    text: '#1e3a8a',
  },
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const style = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration ?? 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-sm w-full"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: style.icon }} />
      <p className="flex-1 text-sm font-medium leading-snug" style={{ color: style.text }}>
        {toast.message}
      </p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
        style={{ color: style.icon }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 2rem)',
        maxWidth: '380px',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

let _addToast: ((type: ToastType, message: string, duration?: number) => void) | null = null;

export function registerToastHandler(handler: typeof _addToast) {
  _addToast = handler;
}

export function toast(type: ToastType, message: string, duration?: number) {
  if (_addToast) {
    _addToast(type, message, duration);
  }
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    registerToastHandler(addToast);
    return () => { registerToastHandler(null); };
  }, [addToast]);

  return { toasts, addToast, dismissToast };
}
