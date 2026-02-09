'use client';

import { WelcomeModal } from './WelcomeModal';

interface DashboardWelcomeClientProps {
  isNewUser: boolean;
}

export function DashboardWelcomeClient({ isNewUser }: DashboardWelcomeClientProps) {
  return <WelcomeModal isNewUser={isNewUser} />;
}
