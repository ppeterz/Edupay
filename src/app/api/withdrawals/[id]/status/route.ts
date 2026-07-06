import { NextRequest } from 'next/server';
import { verifyAuthToken, unauthorized, badRequest } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { requeryTransfer } from '@/lib/nomba';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return unauthorized();

  const { id: withdrawalId } = await params;
  if (!withdrawalId) {
    return badRequest('Withdrawal ID is required');
  }

  const db = getAdminDb();
  const schoolId = decoded.uid;

  try {
    // 1. Fetch withdrawal record and check ownership
    const docRef = db.collection('withdrawals').doc(withdrawalId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return Response.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const withdrawal = doc.data();
    if (withdrawal?.schoolId !== schoolId) {
      return unauthorized();
    }

    // 2. If already resolved (not processing), return the record directly
    if (withdrawal.status !== 'processing') {
      return Response.json({ withdrawal }, { status: 200 });
    }

    const nombaTransferId = withdrawal.nombaTransferId;
    if (!nombaTransferId) {
      // If we don't have a Nomba transfer ID, it is stuck in pending/failed initialisation.
      // Return current record.
      return Response.json({ withdrawal }, { status: 200 });
    }

    // 3. Query Nomba with defensive handling
    try {
      const requeryResult = await requeryTransfer(nombaTransferId);

      let updatedStatus = withdrawal.status;
      let resolvedAt = withdrawal.resolvedAt || null;
      let failureReason = withdrawal.failureReason || null;

      if (requeryResult.status === 'SUCCESS') {
        updatedStatus = 'success';
        resolvedAt = new Date().toISOString();
      } else if (requeryResult.status === 'FAILED') {
        updatedStatus = 'failed';
        resolvedAt = new Date().toISOString();
        failureReason = 'Transfer failed';
      } else if (requeryResult.status === 'REFUND') {
        updatedStatus = 'failed';
        resolvedAt = new Date().toISOString();
        failureReason = 'Transfer refunded';
      }

      // If the status has changed, update Firestore
      if (updatedStatus !== withdrawal.status) {
        const updateData: Record<string, any> = { status: updatedStatus };
        if (resolvedAt) updateData.resolvedAt = resolvedAt;
        if (failureReason) updateData.failureReason = failureReason;

        await docRef.update(updateData);

        const finalRecord = {
          ...withdrawal,
          ...updateData,
        };
        return Response.json({ withdrawal: finalRecord }, { status: 200 });
      }
    } catch (requeryError) {
      // CRITICAL DEFENSIVE REQUIREMENT: Catch all API/Network errors
      // log the error but do NOT update status or mark as failed.
      console.error(
        `Failed to requery Nomba status for transfer ${nombaTransferId}:`,
        requeryError
      );
    }

    // Return current record if no status change occurred or if the check failed
    return Response.json({ withdrawal }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching withdrawal status:', error);
    return Response.json(
      { error: error.message || 'An error occurred while fetching withdrawal status' },
      { status: 500 }
    );
  }
}
