import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './session';

export async function withAuth(
  handler: (request: NextRequest, context: any) => Promise<Response>,
  context?: any
) {
  return async (request: NextRequest) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return handler(request, context);
  };
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return session;
}
