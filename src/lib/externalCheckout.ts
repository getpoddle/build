/** Open hosted Stripe pages outside the Teams embedded tab. */
import { getTeamsSDK } from './teamsAuth';

export async function openExternalCheckout(url: string): Promise<void> {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' || !(
    destination.hostname === 'checkout.stripe.com' ||
    destination.hostname === 'billing.stripe.com' ||
    destination.hostname.endsWith('.checkout.stripe.com')
  )) {
    throw new Error('Unexpected Stripe payment URL. Please try again.');
  }

  if (window.location.pathname === '/teams/app') {
    const teams = await getTeamsSDK();
    if (!teams.pages?.openLink) {
      throw new Error('This version of Microsoft Teams cannot open payment links. Please use Poddle in your browser to complete payment.');
    }
    await teams.pages.openLink(destination.toString());
    return;
  }

  window.location.assign(destination.toString());
}
