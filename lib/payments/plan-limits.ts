/**
 * Plan-based feature limits configuration
 * Defines usage limits for each subscription tier
 */

export type PlanType = 'free' | 'pro' | 'trial' | 'enterprise';

export interface FeatureLimits {
  aiRequests: number;
  apiCalls: number;
  dataProcessing: number; // in MB
  teamMembers: number;
}

export const PLAN_LIMITS: Record<PlanType, FeatureLimits> = {
  free: {
    aiRequests: 10, // 10 AI requests per month
    apiCalls: 100, // 100 API calls per month
    dataProcessing: 100, // 100 MB per month
    teamMembers: 1,
  },
  trial: {
    aiRequests: 100, // 100 AI requests per month
    apiCalls: 1000, // 1000 API calls per month
    dataProcessing: 1000, // 1 GB per month
    teamMembers: 3,
  },
  pro: {
    aiRequests: 10000, // 10k AI requests per month
    apiCalls: 100000, // 100k API calls per month
    dataProcessing: 100000, // 100 GB per month
    teamMembers: 50,
  },
  enterprise: {
    aiRequests: Infinity,
    apiCalls: Infinity,
    dataProcessing: Infinity,
    teamMembers: Infinity,
  },
};

/**
 * Determine the plan type from subscription data
 */
export function getPlanType(planName?: string | null, isTrialing?: boolean): PlanType {
  if (isTrialing) return 'trial';

  if (!planName) return 'free';

  const normalized = planName.toLowerCase();

  if (normalized.includes('pro')) return 'pro';
  if (normalized.includes('enterprise')) return 'enterprise';
  if (normalized.includes('basic') || normalized.includes('base')) return 'free';

  return 'free';
}

/**
 * Get the feature limits for a plan
 */
export function getFeatureLimits(planType: PlanType): FeatureLimits {
  return PLAN_LIMITS[planType];
}

/**
 * Get the total usage limit for a feature
 */
export function getUsageLimit(planType: PlanType, feature: keyof FeatureLimits): number {
  return getFeatureLimits(planType)[feature];
}
