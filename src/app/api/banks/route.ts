import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized } from '@/lib/auth-helpers';
import { listBanks } from '@/lib/nomba';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  try {
    const banks = await listBanks();
    return Response.json({ banks }, { status: 200 });
  } catch (error: any) {
    console.error('Error loading bank list:', error);
    return Response.json(
      { error: error.message || 'Failed to load bank list' },
      { status: 500 }
    );
  }
}
