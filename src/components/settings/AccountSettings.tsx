'use client';

import Image from 'next/image';
import Link from 'next/link';
import { User, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Separator } from '@magnetlab/magnetui';
import { PRICING_PLANS } from '@/lib/types/integrations';
import { UsernameSettings } from '@/components/settings/UsernameSettings';
import { TeamMembersSettings } from '@/components/settings/TeamMembersSettings';

interface AccountSettingsProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  username: string | null;
  subscription: {
    plan: string;
    status: string;
    current_period_end?: string;
  } | null;
  usage: {
    lead_magnets_created?: number;
    posts_scheduled?: number;
  } | null;
  brandKitDescription: string | null;
}

export function AccountSettings({
  user,
  username,
  subscription,
  usage,
  brandKitDescription,
}: AccountSettingsProps) {
  const currentPlan = PRICING_PLANS.find((p) => p.id === subscription?.plan) || PRICING_PLANS[0];

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user.name || ''}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground">
                {user?.name?.[0] || 'U'}
              </div>
            )}
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Separator className="mb-6" />
          <UsernameSettings currentUsername={username} />
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card id="billing" className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Subscription</CardTitle>
            </div>
            <Badge variant="default">{currentPlan.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium">This Month&apos;s Usage</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lead Magnets</span>
              <span className="font-medium">
                {usage?.lead_magnets_created || 0} /{' '}
                {currentPlan.limits.leadMagnets === 999999
                  ? '\u221e'
                  : currentPlan.limits.leadMagnets}
              </span>
            </div>
            {currentPlan.limits.scheduling && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Posts Scheduled</span>
                <span className="font-medium">{usage?.posts_scheduled || 0}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary">
              You have full access during the beta.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              All features are unlocked for beta testers. Use the feedback button in the
              bottom-right corner to report bugs or request features.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Section */}
      <div id="team">
        <TeamMembersSettings />
      </div>

      {/* Brand Kit Summary */}
      {brandKitDescription && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Brand Kit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {brandKitDescription.length > 200
                ? `${brandKitDescription.slice(0, 200)}...`
                : brandKitDescription}
            </p>
            <Link
              href="/create"
              className="mt-4 inline-block text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Update Brand Kit
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
