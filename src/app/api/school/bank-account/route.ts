import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { lookupBankAccount, listBanks } from '@/lib/nomba';

export const runtime = 'nodejs';

// GET - return current saved bank account
export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const db = getAdminDb();
  const schoolDoc = await db.collection('schools').doc(decoded.uid).get();

  if (!schoolDoc.exists) {
    return Response.json({ error: 'School not found' }, { status: 404 });
  }

  const schoolData = schoolDoc.data();
  return Response.json({ bankAccount: schoolData?.bankAccount || null }, { status: 200 });
}

// POST - lookup and preview bank account
export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  try {
    const { accountNumber, bankCode } = await request.json();

    if (!accountNumber || !bankCode) {
      return badRequest('accountNumber and bankCode are required');
    }

    // 1. Resolve bank name
    const banks = await listBanks();
    const targetBank = banks.find((b) => b.code === bankCode);
    const bankName = targetBank ? targetBank.name : 'Unknown Bank';

    // 2. Lookup account name
    const { accountName } = await lookupBankAccount(accountNumber, bankCode);

    // 3. Return preview details (do NOT save to database yet)
    return Response.json({ accountName, bankName }, { status: 200 });
  } catch (error: any) {
    console.error('Error during bank lookup:', error);
    return Response.json(
      { error: error.message || 'Failed to verify bank account' },
      { status: 400 }
    );
  }
}
