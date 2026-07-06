// ──────────────────────────────────────────────
// EduPay — Financial Reconciliation Types
// ──────────────────────────────────────────────

// ── Core Domain Models ───────────────────────

export interface School {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastUsedTermSession?: { term: string; session: string };
  bankAccount?: SchoolBankAccount;
}

export interface Student {
  id: string;
  schoolId: string;
  fullName: string;
  class: string;
  admissionNumber: string;
  virtualAccountNumber: string;
  virtualAccountReference: string;
  virtualAccountBankName: string;
  outstandingBalance: number; // kobo
  creditBalance: number; // kobo
  createdAt: string;
  deletedAt?: string | null;
}

export interface Invoice {
  id: string;
  studentId: string;
  schoolId: string;
  term: string;
  session: string;
  lineItems: InvoiceLineItem[];
  totalAmountDue: number; // kobo
  totalAmountPaid: number; // kobo
  outstandingBalance: number; // kobo
  status: 'unpaid' | 'partial' | 'paid' | 'overpaid';
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amountDue: number; // kobo
  amountPaid: number; // kobo
  priority: number; // 1 = highest priority
  status: 'unpaid' | 'partial' | 'paid';
}

// ── Payment & Reconciliation ─────────────────

export interface Payment {
  id: string;
  studentId: string;
  schoolId: string;
  invoiceId: string;          // PRIMARY invoice (first one touched) — backward compat
  invoiceIds: string[];       // ALL invoices this payment touched, in order
  transactionId: string;
  transactionReference: string;
  amount: number; // kobo
  paymentStatus: 'pending' | 'processed' | 'failed' | 'duplicate';
  allocations: PaymentAllocation[];
  receiptUrl?: string;
  webhookPayload: NombaWebhookPayload;
  processedAt?: string;
  createdAt: string;
}

export interface PaymentAllocation {
  invoiceId: string;        // which invoice this allocation belongs to
  lineItemId: string;
  description: string;
  amountAllocated: number; // kobo
}

export interface ReconciliationEvent {
  id: string;
  studentId: string;
  schoolId: string;
  paymentId: string;
  eventType:
    | 'full_payment'
    | 'underpayment'
    | 'overpayment'
    | 'credit_applied'
    | 'duplicate_rejected';
  amountReceived: number;
  amountAllocated: number;
  creditGenerated: number;
  outstandingBefore: number;
  outstandingAfter: number;
  notes: string;
  createdAt: string;
}

export interface PerInvoiceReconciliation {
  invoiceId: string;
  allocations: PaymentAllocation[];
  updatedLineItems: InvoiceLineItem[];
  newInvoiceStatus: Invoice['status'];
  newTotalAmountPaid: number;
  newOutstandingBalance: number;
  outstandingBefore: number;
}

export interface MultiInvoiceReconciliationResult {
  perInvoice: PerInvoiceReconciliation[];   // only invoices that actually received funds
  creditGenerated: number;
  newStudentCreditBalance: number;
  eventType: ReconciliationEvent['eventType'];
  totalAllocated: number;
}

// ── Nomba API Types ──────────────────────────

export interface NombaAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface NombaVirtualAccountRequest {
  accountName: string;
  accountRef: string;
  bvn?: string;
  nin?: string;
}

export interface NombaVirtualAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accountNumber: string;
    accountName: string;
    accountRef: string;
    bankName: string;
    bankCode: string;
  };
}

export interface NombaWebhookPayload {
  event_type:
    | 'payment_success'
    | 'payout_success'
    | 'payment_failed'
    | 'payment_reversal'
    | 'payout_failed'
    | 'payout_refund';
  requestId: string;
  data: {
    merchant: {
      walletId: string;
      walletBalance: number;
      userId: string;
    };
    terminal: Record<string, unknown>;
    transaction: {
      aliasAccountNumber?: string;
      fee: number;
      sessionId: string;
      type: string;
      transactionId: string;
      aliasAccountName?: string;
      responseCode: string;
      originatingFrom: string;
      transactionAmount: number; // NAIRA with decimals — convert with nairaToKobo() on ingest
      narration: string;
      time: string;
      aliasAccountReference?: string; // THE MATCH KEY — maps to student.virtualAccountReference
      aliasAccountType?: string;
      merchantTxRef?: string;
    };
    customer: {
      bankCode: string;
      senderName: string;
      bankName: string;
      accountNumber: string;
    };
  };
}

// ── Utility Types ────────────────────────────

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export interface DashboardStats {
  totalStudents: number;
  totalRevenue: number;
  outstandingTotal: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
}

// ── Webhook Audit Types ──────────────────────

export interface WebhookLog {
  id: string;
  transactionId: string;
  aliasAccountReference: string;
  amount: number; // kobo (converted from Naira on ingest)
  status: 'received' | 'processed' | 'duplicate' | 'error';
  rawPayload: NombaWebhookPayload;
  createdAt: string;
}

export interface WebhookError {
  id: string;
  aliasAccountReference: string;
  transactionId: string;
  payload: NombaWebhookPayload;
  error: string;
  createdAt: string;
}

// ── Withdrawal & Bank Account Types ──────────

export interface SchoolBankAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  verifiedAt: string;
}

export interface Withdrawal {
  id: string;
  schoolId: string;
  amountRequested: number;      // kobo
  balanceAtRequestTime: number; // kobo
  bankAccount: SchoolBankAccount;
  merchantTxRef: string;        // idempotency key
  nombaTransferId?: string;     // set once initiateTransfer() responds (data.id)
  status: 'pending' | 'processing' | 'success' | 'failed';
  requestedAt: string;
  resolvedAt?: string;
  failureReason?: string;
}


