import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api';
import { checkFeatureAccess, createFeatureBlockedResponse } from '@/lib/payments/feature-gate';
import { getTeamForUser, recordUsage, getMonthlyUsage, getUser } from '@/lib/db/queries';

/**
 * Example gated API route for AI-powered features
 * 
 * This demonstrates:
 * - Auth check
 * - Feature gating with usage limits
 * - Recording usage metrics
 * - Different responses based on plan tier
 * 
 * Users on FREE plan get 10 requests/month
 * Users on PRO plan get 10,000 requests/month
 */
export async function POST(request: NextRequest) {
  // 1. Check authentication
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. Get current usage
  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  const currentUsage = await getMonthlyUsage(team.id, 'ai_requests');

  // 3. Check feature access (this will block if limit exceeded)
  const gateResult = await checkFeatureAccess('aiRequests', currentUsage);
  if (!gateResult.allowed) {
    return createFeatureBlockedResponse(gateResult);
  }

  // 4. Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { prompt } = body;
  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt is required' },
      { status: 400 }
    );
  }

  // 5. Process the AI request (mock implementation)
  // In a real app, you'd call an AI service like OpenAI here
  const user = await getUser();
  const result = `Mock AI response to: "${prompt}"\n\nThis is an example response. In production, this would call your AI service.`;

  // 6. Record the usage
  await recordUsage(
    team.id,
    'ai_requests',
    1,
    user?.id,
    { prompt: prompt.substring(0, 100), timestamp: new Date().toISOString() }
  );

  // 7. Return success response with remaining quota info
  return NextResponse.json({
    success: true,
    result,
    usage: {
      current: currentUsage + 1,
      limit: gateResult.limit,
      remaining: Math.max(0, (gateResult.remaining || 0) - 1),
    },
  });
}

/**
 * Example GET endpoint to check current AI usage
 */
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const team = await getTeamForUser();
  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  const currentUsage = await getMonthlyUsage(team.id, 'ai_requests');
  const gateResult = await checkFeatureAccess('aiRequests', currentUsage);

  return NextResponse.json({
    feature: 'ai_requests',
    current: currentUsage,
    limit: gateResult.limit,
    remaining: gateResult.remaining,
    allowed: gateResult.allowed,
  });
}
