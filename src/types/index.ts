// ──────────────────────────────────────────────
// EduPay — Financial Reconciliation Types
// ──────────────────────────────────────────────

// ── Core Domain Models ───────────────────────

export interface School {
  id: string;
  name: string;
  email: string;
  createdAt: string;
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
  invoiceId: string;
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
  event: string;
  data: {
    transactionId: string;
    amount: number; // kobo
    accountRef: string; // PRIMARY match key — never match by name or amount
    accountNumber: string;
    narration: string;
    currency: string;
    transactionDate: string;
    senderName?: string;
    senderBank?: string;
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
