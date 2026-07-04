// ──────────────────────────────────────────────
// EduPay — Class Status Dot
// ──────────────────────────────────────────────
// Reusable status indicator for invoice collection status per class.
// Used on the invoices grid and the review page.

export type ClassStatus = 'not_invoiced' | 'partial' | 'complete';

interface ClassStatusDotProps {
  status: ClassStatus;
}

const STATUS_CONFIG: Record<
  ClassStatus,
  { dotClass: string; label: string }
> = {
  not_invoiced: {
    dotClass: 'bg-red-500',
    label: 'Not invoiced',
  },
  partial: {
    dotClass: 'bg-amber-400',
    label: 'Partial',
  },
  complete: {
    dotClass: 'bg-green-500',
    label: 'Fully collected',
  },
};

export function ClassStatusDot({ status }: ClassStatusDotProps) {
  const { dotClass, label } = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotClass}`}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </span>
  );
}
