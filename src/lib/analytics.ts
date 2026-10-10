import { phCapture, phPageview, phSetPersonProperties } from './posthog';

export const pageview = (url: string, title?: string) => {
  phPageview(url, title);
};

export const event = (action: string, params?: Record<string, any>) => {
  phCapture(action, params);
};

export const trackUserSignup = (method: string) => {
  event('sign_up', { method });
};

export const trackUserLogin = (method: string) => {
  event('login', { method });
};

export const trackPodCreation = (podName: string, isPublic: boolean) => {
  event('create_pod', { pod_name: podName, is_public: isPublic });
};

export const trackAssumptionCreation = (podId: string, category: string) => {
  event('create_assumption', { pod_id: podId, category });
};

export const trackForecastCreation = (assumptionId: string, outcome: string) => {
  event('create_forecast', { assumption_id: assumptionId, outcome });
};

export const trackRiskCreation = (assumptionId: string, severity: string) => {
  event('create_risk', { assumption_id: assumptionId, severity });
};

export const trackScenarioCreation = (assumptionId: string, likelihood: string) => {
  event('create_scenario', { assumption_id: assumptionId, likelihood });
};

export const trackDecisionThreadCreation = (title: string, category: string) => {
  event('create_decision_thread', { title, category });
};

export const trackChallengeResponse = (challengeId: string, responseLength: number) => {
  event('respond_to_challenge', { challenge_id: challengeId, response_length: responseLength });
};

export const trackMessageSent = (isNewConversation: boolean) => {
  event('send_message', { is_new_conversation: isNewConversation });
};

export const trackProfileUpdate = (fields: string[]) => {
  event('update_profile', { fields_updated: fields.join(',') });
};

export const trackSearch = (searchTerm: string, category: string) => {
  event('search', { search_term: searchTerm, category });
};

export const trackNavigation = (fromPage: string, toPage: string) => {
  event('navigate', { from_page: fromPage, to_page: toPage });
};

export const trackInviteSent = (method: string) => {
  event('send_invite', { method });
};

export const trackError = (errorType: string, errorMessage: string, page: string) => {
  event('exception', { description: errorMessage, error_type: errorType, page, fatal: false });
};

export const trackEngagement = (engagementType: string, duration?: number) => {
  event('engagement', { engagement_type: engagementType, engagement_duration: duration });
};

export const setUserId = (_userId: string) => {
  // Identity is handled directly via phIdentify in AuthContext
};

export const setUserProperties = (properties: Record<string, any>) => {
  phSetPersonProperties(properties);
};
