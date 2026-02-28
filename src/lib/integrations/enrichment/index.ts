import { LeadMagicProvider } from './leadmagic';
import { ProspeoProvider } from './prospeo';
import { BlitzApiProvider } from './blitzapi';
import { ZeroBounceProvider } from './zerobounce';
import { BounceBanProvider } from './bounceban';
import type { EmailFinderProvider, EmailValidatorProvider } from './types';

// Waterfall order: LeadMagic -> Prospeo -> BlitzAPI
const ALL_FINDERS: EmailFinderProvider[] = [
  new LeadMagicProvider(),
  new ProspeoProvider(),
  new BlitzApiProvider(),
];

export function getConfiguredFinders(): EmailFinderProvider[] {
  return ALL_FINDERS.filter((p) => p.isConfigured());
}

export function getValidator(): EmailValidatorProvider | null {
  const zb = new ZeroBounceProvider();
  return zb.isConfigured() ? zb : null;
}

export function getCatchAllValidator(): EmailValidatorProvider | null {
  const bb = new BounceBanProvider();
  return bb.isConfigured() ? bb : null;
}
