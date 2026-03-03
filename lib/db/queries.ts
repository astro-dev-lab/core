import { desc, and, eq, isNull, gte } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, subscriptions, usageTracking } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getFirstTeamMember(teamId: number) {
  const result = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .limit(1);

  return result.length > 0 ? result[0].userId : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.team || null;
}

export async function saveSubscription({
  userId,
  teamId,
  stripeSubscriptionId,
  stripeCustomerId,
  priceId,
  planName,
  status,
  currentPeriodEnd
}: {
  userId: number;
  teamId?: number;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  priceId?: string;
  planName: string;
  status: string;
  currentPeriodEnd: Date;
}) {
  await db
    .insert(subscriptions)
    .values({
      userId,
      teamId,
      stripeSubscriptionId,
      stripeCustomerId,
      priceId,
      planName,
      status,
      currentPeriodEnd
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status,
        currentPeriodEnd,
        updatedAt: new Date(),
        canceledAt: status === 'canceled' ? new Date() : null
      }
    });
}

export async function getActiveSubscriptionForTeam(teamId: number) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.teamId, teamId),
        eq(subscriptions.status, 'active')
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getSubscriptionsForTeam(teamId: number) {
  return await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.teamId, teamId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function isTeamSubscriptionActive(teamId: number) {
  const subscription = await getActiveSubscriptionForTeam(teamId);
  return subscription !== null;
}

/**
 * Record usage for a specific feature
 */
export async function recordUsage(
  teamId: number,
  feature: string,
  amount: number = 1,
  userId?: number,
  metadata?: Record<string, any>
) {
  return await db.insert(usageTracking).values({
    teamId,
    userId: userId || null,
    feature,
    amount,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

/**
 * Get total usage for a feature in the current month
 */
export async function getMonthlyUsage(teamId: number, feature: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db
    .selectDistinct({ totalAmount: usageTracking.amount })
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.teamId, teamId),
        eq(usageTracking.feature, feature),
        gte(usageTracking.createdAt, startOfMonth)
      )
    );

  // Sum up all the usage amounts
  return result.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
}

/**
 * Get total usage for a feature in the current day
 */
export async function getDailyUsage(teamId: number, feature: string): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const result = await db
    .selectDistinct({ totalAmount: usageTracking.amount })
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.teamId, teamId),
        eq(usageTracking.feature, feature),
        gte(usageTracking.createdAt, startOfDay)
      )
    );

  return result.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
}

/**
 * Get all usage records for a team
 */
export async function getTeamUsage(teamId: number) {
  return await db
    .select()
    .from(usageTracking)
    .where(eq(usageTracking.teamId, teamId))
    .orderBy(desc(usageTracking.createdAt));
}
