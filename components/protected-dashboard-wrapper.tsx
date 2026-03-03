import { checkSubscriptionAccess } from '@/lib/payments/subscription';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export async function ProtectedDashboardWrapper({
  children
}: {
  children: React.ReactNode;
}) {
  const subscriptionCheck = await checkSubscriptionAccess();

  if (!subscriptionCheck.hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-md mx-auto">
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Subscription Required
            </h2>

            {subscriptionCheck.reason === 'not_authenticated' && (
              <>
                <p className="text-gray-600 mb-6">
                  You need to sign in to access the dashboard.
                </p>
                <Button asChild className="w-full rounded-full">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </>
            )}

            {subscriptionCheck.reason === 'no_team' && (
              <>
                <p className="text-gray-600 mb-6">
                  You are not part of a team. Please create or join a team.
                </p>
                <Button asChild className="w-full rounded-full">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </>
            )}

            {(subscriptionCheck.reason === 'subscription_inactive' ||
              subscriptionCheck.reason === 'subscription_not_found' ||
              subscriptionCheck.reason === 'subscription_expired') && (
              <>
                <p className="text-gray-600 mb-6">
                  {subscriptionCheck.reason === 'subscription_expired'
                    ? 'Your subscription has expired. '
                    : 'You do not have an active subscription. '}
                  Please upgrade to continue using this feature.
                </p>
                <Button asChild className="w-full rounded-full">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedDashboardWrapper;
