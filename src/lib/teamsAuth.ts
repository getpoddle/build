/** Microsoft Teams popup authentication bridge. Only used on /teams/app and /teams/auth-popup. */
type TeamsSDK = {
  app: { initialize: () => Promise<void> };
  pages?: { openLink?: (url: string) => Promise<void> };
  authentication: {
    authenticate: (options: { url: string; width?: number; height?: number }) => Promise<string>;
    notifySuccess: (result?: string) => void;
    notifyFailure: (reason?: string) => void;
  };
};
declare global { interface Window { microsoftTeams?: TeamsSDK } }
let pending: Promise<TeamsSDK> | null = null;
export function getTeamsSDK(): Promise<TeamsSDK> {
  if (pending) return pending;
  pending = (async () => {
    if (!window.microsoftTeams) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://res.cdn.office.net/teams-js/2.0.0/js/MicrosoftTeams.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Microsoft Teams SDK failed to load'));
        document.head.appendChild(script);
      });
    }
    const sdk = window.microsoftTeams;
    if (!sdk?.authentication || !sdk.app) throw new Error('Microsoft Teams SDK is unavailable');
    await sdk.app.initialize();
    return sdk;
  })().catch((error: unknown) => { pending = null; throw error; });
  return pending;
}
