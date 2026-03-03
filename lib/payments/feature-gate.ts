import { NextResponse } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getActiveSubscriptionForTeam } from '@/lib/db/queries';
import { getPlanType, getUsageLimit } from './plan-limits';
import type { FeatureLimits } from './plan-limits';

export interface FeatureGateResult {
  allowed: boolean;
  reason?: 'no_subscription' | 'limit_exceeded' | 'feature_not_available';
  remaining?: number;
  limit?: number;
  currentUsage?: number;
}

/**
 * Check if a feature is available for the current user
 * Returns whether the feature is allowed and remaining quota
 */
export async function checkFeatureAccess(
  feature: keyof FeatureLimits,
  currentUsage: number = 0
): Promise<FeatureGateResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { allowed: false, reason: 'no_subscription' };
    }

    const team = await getTeamForUser();
    if (!team) {
      return { allowed: false, reason: 'no_subscription' };
    }

    const subscription = await getActiveSubscriptionForTeam(team.id);
    if (!subscription) {
      return { allowed: false, reason: 'no_subscription' };
    }

    const planType = getPlanType(subscription.planName, subscription.status === 'trialing');
    const limit = getUsageLimit(planType, feature);

    if (limit === Infinity) {
      return {
        allowed: true,
        remaining: Infinity,
        limit,
        currentUsage,
      };
    }

    const remaining = Math.max(0, limit - currentUsage);
    const allowed = currentUsage < limit;

    return {
      allowed,
      remaining,
      limit,
      currentUsage,
      reason: allowed ? undefined : 'limit_exceeded',
    };
  } catch (error) {
    console.error('Error checking feature access:', error);
    return { allowed: false, reason: 'feature_not_available' };
  }
}

/**
 * Returns a 403 error response if feature is not available
 */
export function createFeatureBlockedResponse(result: FeatureGateResult) {
  return NextResponse.json(
    {
      error: 'Feature limit exceeded',
      message: `You have reached the limit for this feature. Upgrade to ${
        result.limit === Infinity ? 'Pro' : 'increase your limit'
      } to continue.`,
      limit: result.limit,
      usage: result.currentUsage,
      remaining: result.remaining,
    },
    { status: 403 }
  );
}

/**
 * Middleware wrapper for API routes that need feature gating
 * Usage:
 *   const gateResult = await checkFeatureAccess('aiRequests', currentUsage);
 *   if (!gateResult.allowed) {
 *     return createFeatureBlockedResponse(gateResult);
 *   }
 */
export async function withFeatureGate(
  feature: keyof FeatureLimits,
  handler: (result: FeatureGateResult) => Promise<Response>,
  getCurrentUsage?: () => Promise<number>
): Promise<Response> {
  const currentUsage = await getCurrentUsage?.().catch(() => 0);
  const gateResult = await checkFeatureAccess(feature, currentUsage || 0);

  if (!gateResult.allowed) {
    return createFeatureBlockedResponse(gateResult);
  }

  return handler(gateResult);
}
