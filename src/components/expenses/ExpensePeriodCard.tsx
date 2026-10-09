import { formatExpenseCurrency, type ExpensePeriod, type ExpenseRecord } from "../../services/expenseService";

interface ExpensePeriodCardProps {
  period: ExpensePeriod;
  expenses: ExpenseRecord[];
  total: number;
  onOpen: () => void;
}

export default function ExpensePeriodCard({ period, expenses, total, onOpen }: ExpensePeriodCardProps) {
  return (
    <button type="button" onClick={onOpen} className="group flex min-h-36 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_2px_8px_rgba(62,39,35,0.045)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-ring sm:p-6">
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold text-slate-900">{period.name}</span>
        <span className="mt-1 block text-sm text-slate-500">{period.dateRange}</span>
        <span className="mt-4 block text-xs font-medium text-slate-400">{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Period total</span>
        <span className="mt-1 block text-lg font-semibold tabular-nums text-slate-800">{formatExpenseCurrency(total)}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">Open ledger <span aria-hidden="true">→</span></span>
      </span>
    </button>
  );
}
