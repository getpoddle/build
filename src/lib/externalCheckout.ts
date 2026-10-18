/** Open hosted Stripe pages outside the Teams embedded tab. */
import { getTeamsSDK } from './teamsAuth';

export async function openExternalCheckout(url: string): Promise<boolean> {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' || !(
    destination.hostname === 'checkout.stripe.com' ||
    destination.hostname === 'billing.stripe.com' ||
    destination.hostname.endsWith('.checkout.stripe.com')
  )) {
    throw new Error('Unexpected Stripe payment URL. Please try again.');
  }

  if (window.location.pathname === '/teams/app') {
    let teams;
    try { teams = await getTeamsSDK(); } catch { return false; }
    if (!teams.pages?.openLink) {
      return false;
    }
    try {
      await teams.pages.openLink(destination.toString());
      return true;
    } catch {
      return false;
    }
  }

  window.location.assign(destination.toString());
  return true;
}
