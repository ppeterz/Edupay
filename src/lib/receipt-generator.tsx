// ──────────────────────────────────────────────
// EduPay — PDF Receipt Generator (Redesigned)
// ──────────────────────────────────────────────
// Generates a styled PDF receipt for a processed payment and uploads
// it to Cloudinary. Returns the public URL.
//
// IMPORTANT: This file uses .tsx because @react-pdf/renderer requires
// JSX for its <Document>, <Page>, <Text>, <View> components.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import { uploadPdfToCloudinary } from './cloudinary';
import type { Payment, Student, Invoice, School } from '@/types';
import { kobotoNaira } from './constants';
import path from "path";
import fs from "fs";

const regularFont = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Roboto-Regular.ttf"
);

const boldFont = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Roboto-Bold.ttf"
);

// Verify fonts exist
if (!fs.existsSync(regularFont)) {
  throw new Error(`Missing font: ${regularFont}`);
}

if (!fs.existsSync(boldFont)) {
  throw new Error(`Missing font: ${boldFont}`);
}

// Register Roboto font to support the Naira symbol (U+20A6)
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: regularFont,
      fontWeight: "normal",
    },
    {
      src: boldFont,
      fontWeight: "bold",
    },
  ],
});

/**
 * Format timestamp into standard readable format: "July 4, 2026, 8:14 PM"
 */
function formatReceiptDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Render the PDF receipt to a Buffer.
 * Accepts an array of invoices to support multi-invoice payments.
 */
export async function generateReceiptPdfBuffer(
  payment: Payment,
  student: Student,
  invoices: Invoice[],
  school: School
): Promise<Buffer> {
  const receiptNumber = `RCP-${payment.id.slice(0, 8).toUpperCase()}`;
  const dateStr = payment.processedAt ?? payment.createdAt;

  // Calculate total outstanding across all invoices
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);
  const totalApplied = payment.allocations.reduce((sum, a) => sum + a.amountAllocated, 0);

  const isFullySettled = totalOutstanding === 0;
  const badgeLabel = isFullySettled ? 'PAID' : 'PARTIAL PAYMENT';
  const badgeColor = isFullySettled ? '#22c55e' : '#f59e0b'; // green vs amber
  const creditGenerated = Math.max(0, payment.amount - totalApplied);

  // Group terms and sessions for display
  const termsText = Array.from(new Set(invoices.map((inv) => inv.term))).join(', ');
  const sessionsText = Array.from(new Set(invoices.map((inv) => inv.session))).join(', ');

  // Group allocations by invoice (which represents term and session)
  const allocationsByInvoice = invoices.map(inv => {
    const matchingAllocations = payment.allocations.filter(a => a.invoiceId === inv.id);
    return {
      invoice: inv,
      allocations: matchingAllocations
    };
  }).filter(group => group.allocations.length > 0);

  // Fallback unmatched allocations (just in case)
  const unmatchedAllocations = payment.allocations.filter(
    a => !invoices.some(inv => inv.id === a.invoiceId)
  );

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Banner */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.schoolName}>{school.name}</Text>
            <Text style={styles.receiptTitle}>Payment Receipt</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.receiptRef}>{receiptNumber}</Text>
            <Text style={styles.receiptDate}>{formatReceiptDate(dateStr)}</Text>
          </View>
        </View>

        {/* Paid status badge row */}
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>

        {/* Details columns */}
        <View style={styles.columnsContainer}>
          {/* Student details */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>STUDENT DETAILS</Text>
            <View style={styles.columnUnderline} />
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <Text style={styles.fieldValue}>{student.fullName}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>CLASS</Text>
              <Text style={styles.fieldValue}>{student.class}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>ADMISSION NO.</Text>
              <Text style={styles.fieldValue}>{student.admissionNumber || 'N/A'}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>VIRTUAL ACCOUNT</Text>
              <Text style={styles.fieldValue}>
                {student.virtualAccountNumber} ({student.virtualAccountBankName || 'N/A'})
              </Text>
            </View>
          </View>

          {/* Payment details */}
          <View style={styles.column}>
            <Text style={styles.columnTitle}>PAYMENT DETAILS</Text>
            <View style={styles.columnUnderline} />
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>TRANSACTION REF</Text>
              <Text style={styles.fieldValue}>{payment.transactionReference || 'N/A'}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>TERM</Text>
              <Text style={styles.fieldValue}>{termsText || 'N/A'}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>SESSION</Text>
              <Text style={styles.fieldValue}>{sessionsText || 'N/A'}</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>DATE PROCESSED</Text>
              <Text style={styles.fieldValue}>{formatReceiptDate(dateStr)}</Text>
            </View>
          </View>
        </View>

        {/* Allocation breakdown */}
        <View style={styles.tableContainer}>
          <Text style={styles.allocationTitle}>Allocation Breakdown</Text>
          
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderLeft}>DESCRIPTION</Text>
            <Text style={styles.tableHeaderCenter}>PRIORITY</Text>
            <Text style={styles.tableHeaderRight}>AMOUNT</Text>
          </View>
          
          {/* Table Rows grouped by Invoice/Term */}
          {(() => {
            const chronologicalInvoices = [...invoices].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const latestInvoiceId = chronologicalInvoices[chronologicalInvoices.length - 1]?.id;

            return allocationsByInvoice.map((group, groupIndex) => {
              const isPastClearance = group.invoice.id !== latestInvoiceId;
              const headerLabel = isPastClearance
                ? `${group.invoice.term.toUpperCase()} PAYMENT (PAST OUTSTANDING CLEARANCE)`
                : `${group.invoice.term.toUpperCase()} PAYMENT`;

              return (
                <View key={group.invoice.id} style={{ marginTop: groupIndex > 0 ? 8 : 0 }}>
                  {/* Term Header Row */}
                  <View style={styles.termHeaderRow}>
                    <Text style={styles.termHeaderText}>
                      {headerLabel}
                    </Text>
                  </View>

                  {/* Table Rows for this Group */}
                  {group.allocations.map((a, index) => {
                    let priorityLabel = 'P1';
                    const matchedItem = group.invoice.lineItems.find(
                      (item) => item.id === a.lineItemId || item.description.toLowerCase().trim() === a.description.toLowerCase().trim()
                    );
                    if (matchedItem) {
                      priorityLabel = `P${matchedItem.priority}`;
                    }
                    return (
                      <View key={index} style={[styles.row, index % 2 === 0 ? styles.evenRow : {}]}>
                        <Text style={styles.rowLeft}>{a.description}</Text>
                        <Text style={styles.rowCenter}>{priorityLabel}</Text>
                        <Text style={styles.rowRight}>{kobotoNaira(a.amountAllocated)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()}

          {unmatchedAllocations.length > 0 && (
            <View style={{ marginTop: allocationsByInvoice.length > 0 ? 8 : 0 }}>
              {/* Fallback Header */}
              <View style={styles.termHeaderRow}>
                <Text style={styles.termHeaderText}>OTHER PAYMENTS</Text>
              </View>
              {unmatchedAllocations.map((a, index) => {
                return (
                  <View key={index} style={[styles.row, index % 2 === 0 ? styles.evenRow : {}]}>
                    <Text style={styles.rowLeft}>{a.description}</Text>
                    <Text style={styles.rowCenter}>P1</Text>
                    <Text style={styles.rowRight}>{kobotoNaira(a.amountAllocated)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Summary box */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount Received</Text>
              <Text style={styles.summaryValue}>{kobotoNaira(payment.amount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Applied to Invoice</Text>
              <Text style={styles.summaryValue}>{kobotoNaira(totalApplied)}</Text>
            </View>
            {creditGenerated > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Credit Balance Added</Text>
                <Text style={[styles.summaryValue, { color: '#2563eb' }]}>
                  {kobotoNaira(creditGenerated)}
                </Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.outstandingLabel}>Outstanding Balance</Text>
              {totalOutstanding <= 0 ? (
                <Text style={styles.settledValue}>SETTLED</Text>
              ) : (
                <Text style={styles.outstandingValue}>{kobotoNaira(totalOutstanding)}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Student Balance Carry-Forward */}
        {invoices.length > 0 && (
          <View style={{
            marginHorizontal: 30,
            marginTop: 5,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: '#fde68a',
            borderRadius: 4,
            backgroundColor: '#fefce8',
          }}>
            <Text style={{
              fontSize: 9,
              fontFamily: 'Roboto',
              fontWeight: 'bold',
              color: '#713f12',
              paddingHorizontal: 10,
              paddingTop: 8,
              paddingBottom: 3,
              letterSpacing: 0.5,
            }}>
              STUDENT BALANCE SUMMARY
            </Text>
            <Text style={{
              fontSize: 7.5,
              color: '#92400e',
              paddingHorizontal: 10,
              paddingBottom: 6,
            }}>
              Balance context across all terms at time of this payment
            </Text>

            {/* Per-invoice balance rows */}
            {invoices
              .slice()
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((inv, idx) => {
                // Find allocations from this payment to this invoice
                const matchingAllocations = payment.allocations.filter((a) => a.invoiceId === inv.id);
                const clearedByThisPayment = matchingAllocations.reduce((sum, a) => sum + a.amountAllocated, 0);

                return (
                  <View key={inv.id} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderTopWidth: idx === 0 ? 1 : 0,
                    borderTopColor: '#fde68a',
                    borderBottomWidth: 1,
                    borderBottomColor: '#fef3c7',
                    backgroundColor: idx % 2 === 0 ? '#fefce8' : '#fef9c3',
                  }}>
                    <View style={{ width: '45%' }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#1e293b' }}>
                        {inv.term}
                      </Text>
                      <Text style={{ fontSize: 6.5, color: '#92400e', marginTop: 1 }}>
                        {inv.session}
                      </Text>
                    </View>
                    <View style={{ width: '25%', textAlign: 'right' }}>
                      <Text style={{ fontSize: 7.5, color: '#64748b' }}>
                        Due: {kobotoNaira(inv.totalAmountDue)}
                      </Text>
                      {clearedByThisPayment > 0 && (
                        <Text style={{ fontSize: 7, color: '#1d4ed8', fontWeight: 'bold', marginTop: 1 }}>
                          Cleared: −{kobotoNaira(clearedByThisPayment)}
                        </Text>
                      )}
                    </View>
                    <View style={{ width: '30%', textAlign: 'right' }}>
                      <Text style={{ fontSize: 7.5, color: '#64748b' }}>
                        Outstanding:
                      </Text>
                      <Text style={{
                        fontSize: 8,
                        fontFamily: 'Roboto',
                        fontWeight: 'bold',
                        color: inv.outstandingBalance > 0 ? '#dc2626' : '#16a34a',
                        marginTop: 1,
                      }}>
                        {inv.outstandingBalance > 0 ? kobotoNaira(inv.outstandingBalance) : 'SETTLED'}
                      </Text>
                    </View>
                  </View>
                );
              })}

            {/* Overall balance row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderTopWidth: 1,
              borderTopColor: '#fde68a',
              backgroundColor: '#fef9c3',
            }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 'bold', color: '#0f172a' }}>
                Total Student Outstanding (All Terms)
              </Text>
              <Text style={{
                fontSize: 8.5,
                fontFamily: 'Roboto',
                fontWeight: 'bold',
                color: student.outstandingBalance > 0 ? '#dc2626' : '#16a34a',
              }}>
                {student.outstandingBalance > 0 ? kobotoNaira(student.outstandingBalance) : 'FULLY SETTLED'}
              </Text>
            </View>

            {/* Credit balance note */}
            {student.creditBalance > 0 && (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderTopWidth: 1,
                borderTopColor: '#fde68a',
              }}>
                <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#1d4ed8' }}>
                  Available Credit Balance
                </Text>
                <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold', color: '#1d4ed8' }}>
                  {kobotoNaira(student.creditBalance)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerLeft}>
            Generated by {school.name} Financial Reconciliation System
          </Text>
          <Text style={styles.footerRight}>
            Receipt ID: {payment.id.toUpperCase()}
          </Text>
        </View>

      </Page>
    </Document>
  );

  const pdfStreamBuffer = await renderToBuffer(doc);
  return Buffer.from(pdfStreamBuffer);
}

/**
 * Generate a PDF receipt for a processed payment, upload to Cloudinary (if configured),
 * or fallback to local receipt URL.
 */
export async function generateReceipt(
  payment: Payment,
  student: Student,
  invoices: Invoice[],
  school: School
): Promise<string> {
  const localFallbackUrl = `/api/receipts/${payment.id}`;

  try {
    const buffer = await generateReceiptPdfBuffer(payment, student, invoices, school);

    const publicId = `receipts/${student.schoolId}/${student.id}/${payment.id}`;
    const secureUrl = await uploadPdfToCloudinary(buffer, publicId);

    if (secureUrl.includes('placeholder-cloud') || !secureUrl) {
      console.warn(
        '[receipt-generator] Cloudinary upload failed, falling back to on-demand generation: ' +
          'Cloudinary is not configured or returned a placeholder URL.'
      );
      return localFallbackUrl;
    }

    return secureUrl;
  } catch (err) {
    console.warn(
      '[receipt-generator] Cloudinary upload failed, falling back to on-demand generation: ' +
        (err instanceof Error ? err.message : String(err))
    );
    return localFallbackUrl;
  }
}

// ── PDF Styles ──────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    fontFamily: 'Roboto',
    color: '#1e293b',
    backgroundColor: '#ffffff',
    position: 'relative',
    height: '100%',
  },
  headerContainer: {
    backgroundColor: '#1e293b',
    paddingVertical: 20,
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'column',
    width: '60%',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '35%',
  },
  schoolName: {
    fontSize: 16,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  receiptTitle: {
    fontSize: 10,
    color: '#cbd5e1',
    textTransform: 'capitalize',
  },
  receiptRef: {
    fontSize: 12,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  receiptDate: {
    fontSize: 9,
    color: '#cbd5e1',
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    marginBottom: 5,
    paddingHorizontal: 30,
  },
  badge: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginTop: 10,
    marginBottom: 15,
  },
  column: {
    width: '47%',
    flexDirection: 'column',
  },
  columnTitle: {
    fontSize: 9,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  columnUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 3,
    marginBottom: 8,
  },
  fieldContainer: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    marginBottom: 1.5,
  },
  fieldValue: {
    fontSize: 9.5,
    color: '#1e293b',
    fontFamily: 'Roboto',
  },
  tableContainer: {
    paddingHorizontal: 30,
    marginTop: 10,
    marginBottom: 10,
  },
  allocationTitle: {
    fontSize: 10.5,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  termHeaderRow: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    flexDirection: 'row',
  },
  termHeaderText: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8,
    color: '#334155',
    letterSpacing: 0.5,
  },
  tableHeaderLeft: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: '#475569',
    width: '50%',
  },
  tableHeaderCenter: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: '#475569',
    width: '20%',
    textAlign: 'center',
  },
  tableHeaderRight: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: '#475569',
    width: '30%',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  evenRow: {
    backgroundColor: '#f8fafc',
  },
  rowLeft: {
    fontSize: 9.5,
    color: '#334155',
    width: '50%',
  },
  rowCenter: {
    fontSize: 9.5,
    color: '#64748b',
    width: '20%',
    textAlign: 'center',
  },
  rowRight: {
    fontSize: 9.5,
    color: '#1e293b',
    width: '30%',
    textAlign: 'right',
  },
  summaryContainer: {
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    marginBottom: 30,
  },
  summaryBox: {
    width: '45%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 8.5,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 5,
  },
  outstandingLabel: {
    fontSize: 9.5,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  settledValue: {
    fontSize: 9.5,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#10b981',
    textAlign: 'right',
  },
  outstandingValue: {
    fontSize: 9.5,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'right',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 7.5,
    color: '#94a3b8',
    width: '65%',
  },
  footerRight: {
    fontSize: 7.5,
    color: '#94a3b8',
    width: '30%',
    textAlign: 'right',
  },
});
