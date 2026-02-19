// Integration exports for MagnetLab

export { BaseApiClient, type ApiClientConfig, type ApiResponse } from './base-client';

export {
  FathomClient,
  getUserFathomClient,
  getFathomAuthorizationUrl,
  exchangeFathomCode,
  refreshFathomToken,
} from './fathom';

export {
  AttioClient,
  createAttioClient,
  calcDurationMinutes,
  extractParticipants,
  type AttioCallRecordingCreatedEvent,
} from './attio';

export {
  createCustomer,
  getCustomer,
  getOrCreateCustomer,
  createCheckoutSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  changeSubscriptionPlan,
  createBillingPortalSession,
  constructWebhookEvent,
  getPlanFromPriceId,
  parseSubscriptionEvent,
  STRIPE_PRICE_IDS,
  type CreateCheckoutOptions,
  type SubscriptionWebhookData,
} from './stripe';
