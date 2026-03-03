import { getUser, getTeamForUser, isTeamSubscriptionActive, getActiveSubscriptionForTeam } from '@/lib/db/queries';

export async function requireActiveSubscription() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const team = await getTeamForUser();
  if (!team) {
    throw new Error('User is not part of a team');
  }

  const hasActiveSubscription = await isTeamSubscriptionActive(team.id);
  if (!hasActiveSubscription) {
    return {
      hasAccess: false,
      reason: 'subscription_inactive',
      team,
      user
    };
  }

  const subscription = await getActiveSubscriptionForTeam(team.id);
  if (!subscription) {
    return {
      hasAccess: false,
      reason: 'subscription_not_found',
      team,
      user
    };
  }

  // Check if subscription period has ended
  const now = new Date();
  if (subscription.currentPeriodEnd < now) {
    return {
      hasAccess: false,
      reason: 'subscription_expired',
      team,
      user,
      subscription
    };
  }

  return {
    hasAccess: true,
    team,
    user,
    subscription
  };
}

export interface SubscriptionCheckResult {
  hasAccess: boolean;
  reason?: 'subscription_inactive' | 'subscription_not_found' | 'subscription_expired' | 'not_authenticated' | 'no_team';
  team?: any;
  user?: any;
  subscription?: any;
}

export async function checkSubscriptionAccess(): Promise<SubscriptionCheckResult> {
  try {
    const result = await requireActiveSubscription();
    // TypeScript guard to ensure the reason field matches the expected type
    return result as SubscriptionCheckResult;
  } catch (error: any) {
    if (error.message === 'User not authenticated') {
      return { hasAccess: false, reason: 'not_authenticated' };
    }
    if (error.message === 'User is not part of a team') {
      return { hasAccess: false, reason: 'no_team' };
    }
    return { hasAccess: false, reason: 'subscription_inactive' };
  }
}

export function isSubscriptionAccessBlocked(result: SubscriptionCheckResult): boolean {
  return !result.hasAccess;
}
