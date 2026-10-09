import { useState, useEffect } from 'react';
import { Cookie, X, ShieldCheck } from 'lucide-react';
import { getCookieConsent, setCookieConsent, type CookieChoice } from '../lib/cookieConsent';

export default function CookieConsent({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [choice, setChoice] = useState<CookieChoice>(() => getCookieConsent());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (choice) setDismissed(true);
  }, [choice]);

  if (choice || dismissed) return null;

  const handleAccept = () => {
    setCookieConsent('accepted');
    setChoice('accepted');
  };

  const handleDecline = () => {
    setCookieConsent('declined');
    setChoice('declined');
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-4 sm:px-6 sm:pb-6"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="mx-auto max-w-2xl pointer-events-auto"
        style={{
          background: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'cookieSlideUp 0.3s ease-out',
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--signal-bg)' }}
            >
              <Cookie className="w-5 h-5" style={{ color: 'var(--signal)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--app-text-primary)' }}>
                We value your privacy
              </h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--app-text-secondary)' }}>
                We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                By clicking "Accept", you consent to our use of analytics cookies. You can change your preference at any time.
                {' '}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('privacy')}
                    className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--signal)' }}
                  >
                    Read our Privacy Policy
                  </button>
                )}
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5">
                <button
                  onClick={handleDecline}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold transition-all hover:opacity-80"
                  style={{
                    background: 'transparent',
                    color: 'var(--app-text-muted)',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-md text-xs font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'var(--signal)',
                    color: 'var(--ink-950)',
                    border: '1px solid var(--signal)',
                    boxShadow: 'var(--shadow-signal)',
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes cookieSlideUp {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
