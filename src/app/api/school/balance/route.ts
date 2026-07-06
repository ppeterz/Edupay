import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/auth-helpers';
import { getSubAccountBalance } from '@/lib/nomba';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  try {
    const balanceKobo = await getSubAccountBalance();
    return Response.json({ balanceKobo }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching sub-account balance:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch sub-account balance' },
      { status: 500 }
    );
  }
}
