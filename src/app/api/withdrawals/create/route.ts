import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { getSubAccountBalance, initiateTransfer } from '@/lib/nomba';
import { nairaToKobo } from '@/lib/constants';

export const runtime = 'nodejs';

// ₦50 fee buffer for transfer fees (5000 kobo)
const TRANSFER_FEE_BUFFER_KOBO = 5000;

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const schoolId = decoded.uid;
  const db = getAdminDb();

  try {
    // 1. Fetch school doc and check for bank account
    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    if (!schoolDoc.exists) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const schoolData = schoolDoc.data();
    if (!schoolData?.bankAccount) {
      return badRequest('Add a payout bank account first');
    }

    const bankAccount = schoolData.bankAccount;

    // 2. Parse and validate amount
    const { amountNaira } = await request.json();
    if (amountNaira === undefined || typeof amountNaira !== 'number' || amountNaira <= 0) {
      return badRequest('A positive amount is required');
    }

    const amountKobo = nairaToKobo(amountNaira);

    // 3. Check live sub-account balance (never trust Firestore totals)
    const realBalanceKobo = await getSubAccountBalance();

    const maxWithdrawableKobo = realBalanceKobo - TRANSFER_FEE_BUFFER_KOBO;
    if (amountKobo > maxWithdrawableKobo) {
      return badRequest(
        `Insufficient balance. Sub-account balance: ₦${(realBalanceKobo / 100).toFixed(
          2
        )}, withdrawable limit (after ₦50 fee buffer): ₦${Math.max(0, maxWithdrawableKobo / 100).toFixed(2)}`
      );
    }

    // 4. Generate unique merchantTxRef (idempotency key)
    const merchantTxRef = `wd_${schoolId}_${Date.now()}`;

    // 5. Create Withdrawal doc with 'pending' status BEFORE calling Nomba
    const withdrawalId = db.collection('withdrawals').doc().id;
    const requestedAt = new Date().toISOString();

    const withdrawalRecord = {
      id: withdrawalId,
      schoolId,
      amountRequested: amountKobo,
      balanceAtRequestTime: realBalanceKobo,
      bankAccount,
      merchantTxRef,
      status: 'pending',
      requestedAt,
    };

    await db.collection('withdrawals').doc(withdrawalId).set(withdrawalRecord);

    // 6. Initiate Transfer
    let transferResult;
    try {
      transferResult = await initiateTransfer({
        amountKobo,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankCode: bankAccount.bankCode,
        merchantTxRef,
        narration: `EduPay Withdrawal for ${schoolData.name || 'School'}`,
      });
    } catch (transferError: any) {
      // If the API call fails or throws, update doc to failed status
      const failureReason = transferError.message || 'Nomba API transfer call failed';
      const failedRecord = {
        ...withdrawalRecord,
        status: 'failed' as const,
        failureReason,
        resolvedAt: new Date().toISOString(),
      };
      await db.collection('withdrawals').doc(withdrawalId).set(failedRecord);
      return Response.json(failedRecord, { status: 400 });
    }

    // 7. Update document based on Nomba transfer result
    const resolvedAt = new Date().toISOString();
    let finalRecord;

    if (transferResult.status === 'SUCCESS') {
      finalRecord = {
        ...withdrawalRecord,
        status: 'success' as const,
        nombaTransferId: transferResult.id,
        resolvedAt,
      };
    } else if (transferResult.status === 'FAILED') {
      finalRecord = {
        ...withdrawalRecord,
        status: 'failed' as const,
        nombaTransferId: transferResult.id,
        failureReason: 'Transfer rejected by provider',
        resolvedAt,
      };
    } else if (transferResult.status === 'REFUND') {
      finalRecord = {
        ...withdrawalRecord,
        status: 'failed' as const,
        nombaTransferId: transferResult.id,
        failureReason: 'Transfer failed and was refunded',
        resolvedAt,
      };
    } else {
      // PENDING or PROCESSING
      finalRecord = {
        ...withdrawalRecord,
        status: 'processing' as const,
        nombaTransferId: transferResult.id,
      };
    }

    await db.collection('withdrawals').doc(withdrawalId).set(finalRecord);

    return Response.json(finalRecord, { status: 201 });
  } catch (error: any) {
    console.error('Error creating withdrawal:', error);
    return Response.json(
      { error: error.message || 'An error occurred during withdrawal creation' },
      { status: 500 }
    );
  }
}
