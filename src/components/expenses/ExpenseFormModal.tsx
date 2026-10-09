import { useEffect, useState, type FormEvent } from "react";
import type { ExpenseFields, ExpensePeriod, ExpenseRecord } from "../../services/expenseService";
import { dateToFinancialYear, financialYearForStartYear } from "../../services/registerService";

interface ExpenseFormModalProps {
  year: number;
  periods: ExpensePeriod[];
  initialPeriodId?: string;
  expense?: ExpenseRecord;
  onClose: () => void;
  onSave: (fields: ExpenseFields) => void;
}

interface FormErrors {
  title?: string;
  amount?: string;
  date?: string;
  periodId?: string;
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day);
}

function getPeriodStartDate(year: number, periodId: string): string {
  const starts: Record<string, string> = {
    "period-1": `${year}-04-01`,
    "period-2": `${year}-07-01`,
    "period-3": `${year}-10-01`,
    "period-4": `${year + 1}-01-01`,
  };
  return starts[periodId] ?? `${year}-04-01`;
}

export default function ExpenseFormModal({ year, periods, initialPeriodId, expense, onClose, onSave }: ExpenseFormModalProps) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [periodId, setPeriodId] = useState(expense?.periodId ?? initialPeriodId ?? periods[0]?.id ?? "");
  const [date, setDate] = useState(expense?.date ?? getPeriodStartDate(year, initialPeriodId ?? periods[0]?.id ?? ""));
  const [dateTouched, setDateTouched] = useState(false);
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = "Enter an expense name.";
    if (!amount.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) nextErrors.amount = "Enter an amount greater than zero.";
    if (!isValidDate(date) || dateToFinancialYear(date) !== financialYearForStartYear(year)) nextErrors.date = `Choose a date within FY ${year}–${String(year + 1).slice(-2)} (April–March).`;
    if (!periods.some((period) => period.id === periodId)) nextErrors.periodId = "Select an expense period.";
    const month = Number(date.slice(5, 7));
    const expectedPeriod = month >= 4 && month <= 6 ? "period-1" : month >= 7 && month <= 9 ? "period-2" : month >= 10 && month <= 12 ? "period-3" : month >= 1 && month <= 3 ? "period-4" : "";
    if (isValidDate(date) && periodId !== expectedPeriod) nextErrors.periodId = "Choose the period that contains the selected date.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      year,
      periodId,
      title: title.trim(),
      amount: numericAmount,
      date,
      notes: notes.trim(),
    });
  }

  const fieldClass = "form-control";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="expense-form-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">{expense ? "Update record" : "New record"}</p>
            <h2 id="expense-form-title" className="mt-1 font-display text-xl font-semibold text-slate-900">{expense ? "Edit expense" : "Add expense"}</h2>
            <p className="mt-1 text-sm text-slate-500">Record an expense for financial year {year}–{String(year + 1).slice(-2)}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close expense form" className="focus-ring rounded-lg p-2 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">×</button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Expense name</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "expense-title-error" : undefined} className={fieldClass} placeholder="e.g. Community hall repairs" />
            {errors.title && <span id="expense-title-error" className="mt-1 block text-xs text-rose-600">{errors.title}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "expense-amount-error" : undefined} className={fieldClass} style={{ paddingLeft: "2rem" }} placeholder="0.00" />
            </div>
            {errors.amount && <span id="expense-amount-error" className="mt-1 block text-xs text-rose-600">{errors.amount}</span>}
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span>
            <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setDateTouched(true); }} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "expense-date-error" : undefined} className={fieldClass} />
            {errors.date && <span id="expense-date-error" className="mt-1 block text-xs text-rose-600">{errors.date}</span>}
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Expense period</span>
            <select value={periodId} onChange={(event) => {
              const value = event.target.value;
              setPeriodId(value);
              if (!expense && !dateTouched) setDate(getPeriodStartDate(year, value));
            }} aria-invalid={Boolean(errors.periodId)} aria-describedby={errors.periodId ? "expense-period-error" : undefined} className={fieldClass}>
              <option value="">Select a period</option>
              {periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.dateRange}</option>)}
            </select>
            {errors.periodId && <span id="expense-period-error" className="mt-1 block text-xs text-rose-600">{errors.periodId}</span>}
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Notes <span className="font-normal text-slate-400">(optional)</span></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${fieldClass} h-auto py-2.5`} placeholder="Add any useful details..." />
          </label>
        </div>

        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="action-button border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="action-button border-blue-600 bg-blue-600 text-white shadow-sm hover:border-blue-700 hover:bg-blue-700">{expense ? "Save changes" : "Add expense"}</button>
        </footer>
      </form>
    </div>
  );
}
