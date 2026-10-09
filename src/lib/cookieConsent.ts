export type CookieChoice = 'accepted' | 'declined' | null;

const STORAGE_KEY = 'poddle_cookie_consent';

export function getCookieConsent(): CookieChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch {}
  return null;
}

export function setCookieConsent(choice: 'accepted' | 'declined') {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {}
  window.dispatchEvent(new CustomEvent('poddle:cookie-consent', { detail: choice }));
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}

export function onCookieConsentChange(cb: (choice: CookieChoice) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as CookieChoice);
  window.addEventListener('poddle:cookie-consent', handler);
  return () => window.removeEventListener('poddle:cookie-consent', handler);
}
