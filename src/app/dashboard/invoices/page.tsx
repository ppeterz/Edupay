'use client';

// ──────────────────────────────────────────────
// EduPay — Class Invoicing Page
// ──────────────────────────────────────────────
// Bulk invoice creation for entire classes or categories.
// Direct class structure clicks navigate to the dedicated invoice review page.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLASS_CATEGORIES } from '@/lib/constants';
import type { ClassCategory } from '@/lib/constants';
import { BulkInvoiceForm, type BulkInvoiceResult } from '@/components/invoices/BulkInvoiceForm';
import { BulkInvoiceResultSummary } from '@/components/invoices/BulkInvoiceResultSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, FileText } from 'lucide-react';

const CATEGORY_KEYS = Object.keys(CLASS_CATEGORIES) as ClassCategory[];

export default function InvoicingPage() {
  const router = useRouter();

  // Bulk create dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkInvoiceResult | null>(null);

  function handleSuccess(result: BulkInvoiceResult) {
    setBulkResult(result);
  }

  function handleClose() {
    setBulkResult(null);
    setDialogOpen(false);
  }

  function handleOpenReview(cls: string) {
    router.push(`/dashboard/invoices/review?class=${encodeURIComponent(cls)}`);
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Invoicing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create invoices for an entire class or category in one action
        </p>
      </div>

      {/* CTA Card */}
      <Card className="mb-8">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">New Bulk Invoice</h2>
              <p className="text-sm text-gray-500">
                Apply one invoice template to all students in a class or category
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bulk Invoice
          </Button>
        </CardContent>
      </Card>

      {/* Class structure reference */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Class Structure</h2>
        <p className="text-sm text-gray-500">
          Click on any class to review and update existing invoices and their priorities
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_KEYS.map((category) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {CLASS_CATEGORIES[category].map((cls) => (
                    <li key={cls}>
                      <button
                        type="button"
                        onClick={() => handleOpenReview(cls)}
                        className="w-full rounded-md bg-gray-50 px-3 py-1.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                      >
                        {cls}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog — Bulk Create */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bulkResult ? 'Bulk Invoice Results' : 'Create Bulk Invoice'}
            </DialogTitle>
          </DialogHeader>

          {bulkResult ? (
            <BulkInvoiceResultSummary result={bulkResult} onClose={handleClose} />
          ) : (
            <BulkInvoiceForm
              onSuccess={handleSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
