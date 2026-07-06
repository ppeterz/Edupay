import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { lookupBankAccount } from '@/lib/nomba';

export const runtime = 'nodejs';

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  try {
    const { accountNumber, accountName, bankCode, bankName } = await request.json();

    if (!accountNumber || !accountName || !bankCode || !bankName) {
      return badRequest('accountNumber, accountName, bankCode, and bankName are required');
    }

    // 1. Re-verify the bank account name server-side to prevent tampering
    const { accountName: verifiedName } = await lookupBankAccount(accountNumber, bankCode);

    if (normalizeName(accountName) !== normalizeName(verifiedName)) {
      return badRequest(
        `Account name verification mismatch. Received: "${accountName}", Verified: "${verifiedName}"`
      );
    }

    // 2. Save the bank account details to the school's document
    const db = getAdminDb();
    const verifiedAt = new Date().toISOString();
    const bankAccount = {
      accountNumber,
      accountName: verifiedName, // use verified name
      bankCode,
      bankName,
      verifiedAt,
    };

    await db.collection('schools').doc(decoded.uid).update({
      bankAccount,
    });

    return Response.json({ success: true, bankAccount }, { status: 200 });
  } catch (error: any) {
    console.error('Error in bank-account confirmation:', error);
    return Response.json(
      { error: error.message || 'Failed to confirm and save bank account' },
      { status: 400 }
    );
  }
}
