export const dynamic = 'force-dynamic';

import { getUser } from '@/lib/db/queries';
import { requireAuth } from '@/lib/auth/api';
import { checkSubscriptionAccess } from '@/lib/payments/subscription';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check subscription status
  const subscriptionCheck = await checkSubscriptionAccess();
  if (!subscriptionCheck.hasAccess) {
    return NextResponse.json(
      { error: 'No active subscription', reason: subscriptionCheck.reason },
      { status: 403 }
    );
  }

  const user = await getUser();
  return Response.json(user);
}
