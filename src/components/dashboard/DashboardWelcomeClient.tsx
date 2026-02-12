'use client';

import { WelcomeModal } from './WelcomeModal';
import { ProductTour } from '@/components/onboarding/ProductTour';

interface DashboardWelcomeClientProps {
  isNewUser: boolean;
}

export function DashboardWelcomeClient({ isNewUser }: DashboardWelcomeClientProps) {
  return (
    <>
      <WelcomeModal isNewUser={isNewUser} />
      <ProductTour isNewUser={isNewUser} />
    </>
  );
}
