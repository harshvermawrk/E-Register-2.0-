import { formatExpenseCurrency, type ExpenseSummary as ExpenseSummaryData } from "../../services/expenseService";

interface ExpenseSummaryProps {
  summary: ExpenseSummaryData;
  yearLabel: string;
}

export default function ExpenseSummary({ summary, yearLabel }: ExpenseSummaryProps) {
  const cards = [
    { label: "Total expenses", amount: summary.totalExpense, note: `Recorded in ${yearLabel}`, accent: "var(--color-amber-700)", tint: "var(--color-gold-soft)", icon: "↗" },
  ];

  return (
    <section aria-label={`Expense summary for ${yearLabel}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="flex min-w-0 items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(62,39,35,0.045)] sm:p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 break-words font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{formatExpenseCurrency(card.amount)}</p>
            <p className="mt-2 text-xs text-slate-400">{card.note}</p>
          </div>
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold" style={{ color: card.accent, backgroundColor: card.tint }}>{card.icon}</span>
        </article>
      ))}
    </section>
  );
}
