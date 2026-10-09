import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { useNavigate, useParams } from "react-router-dom";
import ExpenseFormModal from "./ExpenseFormModal";
import {
  calculatePeriodExpense,
  collectionYears,
  createExpense,
  deleteExpense,
  expensePeriods,
  formatExpenseCurrency,
  updateExpense,
  type ExpenseFields,
  type ExpenseRecord,
} from "../../services/expenseService";
import { dateToFinancialYear, financialYearForStartYear } from "../../services/registerService";

interface ExpensePeriodPageProps {
  savedExpenses: ExpenseRecord[];
  cloudMode: boolean;
  onExpensesChange: (expenses: ExpenseRecord[]) => void;
  onSaveCloudExpenses: (expenses: ExpenseRecord[]) => Promise<void>;
}

function formatExpenseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function periodStartDate(year: number, periodId: string) {
  const starts: Record<string, string> = {
    "period-1": `${year}-04-01`,
    "period-2": `${year}-07-01`,
    "period-3": `${year}-10-01`,
    "period-4": `${year + 1}-01-01`,
  };
  return starts[periodId] ?? `${year}-04-01`;
}

function periodDateRange(year: number, periodId: string): [string, string] {
  const ranges: Record<string, [string, string]> = {
    "period-1": [`${year}-04-01`, `${year}-06-30`],
    "period-2": [`${year}-07-01`, `${year}-09-30`],
    "period-3": [`${year}-10-01`, `${year}-12-31`],
    "period-4": [`${year + 1}-01-01`, `${year + 1}-03-31`],
  };
  return ranges[periodId] ?? [`${year}-04-01`, `${year}-06-30`];
}

export default function ExpensePeriodPage({
  savedExpenses,
  cloudMode,
  onExpensesChange,
  onSaveCloudExpenses,
}: ExpensePeriodPageProps) {
  const navigate = useNavigate();
  const { year: yearParam = "", periodId = "" } = useParams();
  const year = Number(yearParam);
  const period = expensePeriods.find((item) => item.id === periodId);
  const validYear = collectionYears.some((item) => item.id === year);
  const [expenses, setExpenses] = useState(savedExpenses);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState(() => periodStartDate(year, periodId));
  const [draftNotes, setDraftNotes] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Pending" | "Failed">("All");
  const titleInput = useRef<HTMLInputElement>(null);
  const skippedInitialCloudSave = useRef(false);
  const periodExpenses = useMemo(
    () => expenses.filter((expense) => expense.year === year && expense.periodId === periodId)
      .sort((first, second) => second.date.localeCompare(first.date)),
    [expenses, periodId, year],
  );
  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return periodExpenses.filter((expense) => {
      const expenseStatus = expense.status ?? "Paid";
      if (statusFilter !== "All" && expenseStatus !== statusFilter) return false;
      if (!query) return true;
      return [
        expense.title,
        expense.date,
        expense.notes,
        expense.receiptId ?? "",
        expense.paymentMode ?? "",
        expenseStatus,
        String(expense.amount),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [periodExpenses, search, statusFilter]);
  const total = calculatePeriodExpense(expenses, year, periodId);
  const average = periodExpenses.length ? total / periodExpenses.length : 0;
  const [periodMinDate, periodMaxDate] = periodDateRange(year, periodId);
  const isErrorStatus = status.startsWith("Enter ")
    || status.startsWith("Choose ")
    || status.startsWith("The change is shown");

  useEffect(() => {
    setDraftDate(periodStartDate(year, periodId));
  }, [periodId, year]);

  useEffect(() => {
    onExpensesChange(expenses);
  }, [expenses, onExpensesChange]);

  useEffect(() => {
    if (cloudMode) {
      if (!skippedInitialCloudSave.current) {
        skippedInitialCloudSave.current = true;
        return;
      }
      void onSaveCloudExpenses(expenses)
        .then(() => setStatus(""))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Expenses could not be saved to the cloud.";
          setStatus(`The change is shown for this session but was not saved: ${message}`);
        });
      return;
    }
    try {
      window.localStorage.setItem("e-register.expenses.v1", JSON.stringify(expenses));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Expenses could not be saved in this browser.";
      setStatus(`The change is shown for this session but could not be saved: ${message}`);
    }
  }, [cloudMode, expenses, onSaveCloudExpenses]);

  function saveExpense(fields: ExpenseFields) {
    setExpenses((current) => editingExpense
      ? updateExpense(current, editingExpense.id, fields)
      : createExpense(current, fields));
    setStatus(editingExpense ? "Expense updated." : "Expense added.");
    setEditingExpense(null);
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(draftAmount);
    if (!draftTitle.trim()) {
      setStatus("Enter an expense name.");
      titleInput.current?.focus();
      return;
    }
    if (!draftAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setStatus("Enter an amount greater than zero.");
      return;
    }
    if (dateToFinancialYear(draftDate) !== financialYearForStartYear(year)) {
      setStatus("Choose a valid date within this financial year.");
      return;
    }
    const month = Number(draftDate.slice(5, 7));
    const expectedPeriod = month >= 4 && month <= 6 ? "period-1" : month >= 7 && month <= 9 ? "period-2" : month >= 10 && month <= 12 ? "period-3" : "period-4";
    if (expectedPeriod !== periodId) {
      setStatus(`Choose a date within ${period?.name ?? "this period"}.`);
      return;
    }

    setExpenses((current) => createExpense(current, {
      year,
      periodId,
      title: draftTitle.trim(),
      amount,
      date: draftDate,
      notes: draftNotes.trim(),
    }));
    setDraftTitle("");
    setDraftAmount("");
    setDraftDate(periodStartDate(year, periodId));
    setDraftNotes("");
    setStatus("Expense added.");
    requestAnimationFrame(() => titleInput.current?.focus());
  }

  function removeExpense(expense: ExpenseRecord) {
    if (!window.confirm(`Delete “${expense.title}” (${formatExpenseCurrency(expense.amount)})?`)) return;
    setExpenses((current) => deleteExpense(current, expense.id));
    setStatus("Expense deleted.");
  }

  function exportPeriod() {
    const rows = periodExpenses.map((expense) => ({
      "Financial year": `${year}–${String(year + 1).slice(-2)}`,
      Period: period?.name ?? periodId,
      Expense: expense.title,
      Date: expense.date,
      Amount: expense.amount,
      Notes: expense.notes,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Expenses");
    XLSX.writeFile(workbook, `expenses-${year}-${periodId}.xlsx`);
  }

  if (!validYear || !period) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Expense period not found</h2>
        <p className="mt-2 text-sm text-slate-500">Choose a valid financial year and expense period.</p>
        <button type="button" onClick={() => navigate("/expenses-collection")} className="mt-6 action-button border-blue-600 bg-blue-600 text-white">Back to Expenses</button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <button type="button" onClick={() => navigate("/expenses-collection")} className="hover:text-blue-600">Expenses</button>
            <span>/</span><span>{period.name}</span>
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{period.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{period.dateRange} · Financial year {year}–{String(year + 1).slice(-2)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportPeriod} className="action-button border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Export period</button>
          <button type="button" onClick={() => titleInput.current?.focus()} className="action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700">+ Add expense</button>
        </div>
      </header>

      {status && <p role={isErrorStatus ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${isErrorStatus ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{status}</p>}

      <section aria-label={`${period.name} summary`} className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total expenses", value: formatExpenseCurrency(total) },
          { label: "Expense records", value: periodExpenses.length.toLocaleString("en-IN") },
          { label: "Average expense", value: formatExpenseCurrency(average) },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(62,39,35,0.045)]">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="period-expenses-title" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(62,39,35,0.045)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 id="period-expenses-title" className="font-display text-lg font-semibold text-slate-900">Expense records</h3>
                <p className="mt-1 text-sm text-slate-500">All expenses recorded for this period.</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-slate-700">Total {formatExpenseCurrency(total)}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label>
                <span className="sr-only">Search expenses</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, notes, receipt, or amount" className="form-control min-h-9" />
              </label>
              <label>
                <span className="sr-only">Filter expenses by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="form-control min-h-9">
                  <option value="All">All statuses</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Failed">Failed</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        {filteredExpenses.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-slate-600">{periodExpenses.length === 0 ? "No expenses recorded for this period." : "No expenses match these filters."}</p>
            <p className="mt-1 text-sm text-slate-400">{periodExpenses.length === 0 ? "Add the first expense to start this period ledger." : "Try a different search or status."}</p>
            {periodExpenses.length === 0
              ? <button type="button" onClick={() => titleInput.current?.focus()} className="mt-4 action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700">+ Add expense</button>
              : <button type="button" onClick={() => { setSearch(""); setStatusFilter("All"); }} className="mt-4 action-button border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Clear filters</button>}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredExpenses.map((expense) => (
              <li key={expense.id} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{expense.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatExpenseDate(expense.date)}{expense.notes ? ` · ${expense.notes}` : ""}</p>
                </div>
                <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-slate-800">{formatExpenseCurrency(expense.amount)}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setEditingExpense(expense)} aria-label={`Edit ${expense.title}`} className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50">Edit</button>
                  <button type="button" onClick={() => removeExpense(expense)} aria-label={`Delete ${expense.title}`} className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addExpense} className="grid gap-3 border-t border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(180px,1.2fr)_130px_160px_minmax(160px,1fr)_auto] lg:items-end">
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Expense name</span>
            <input ref={titleInput} autoComplete="off" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Enter expense" className="form-control min-h-10" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Amount</span>
            <input type="number" min="0.01" step="0.01" value={draftAmount} onChange={(event) => setDraftAmount(event.target.value)} placeholder="₹ 0" className="form-control min-h-10" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Date</span>
            <input type="date" min={periodMinDate} max={periodMaxDate} value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className="form-control min-h-10" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Notes <span className="font-normal text-slate-400">(optional)</span></span>
            <input value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} placeholder="Details..." className="form-control min-h-10" />
          </label>
          <button type="submit" className="action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700">Add row</button>
        </form>
      </section>

      {editingExpense && (
        <ExpenseFormModal
          key={editingExpense.id}
          year={year}
          periods={[period]}
          initialPeriodId={periodId}
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={saveExpense}
        />
      )}
    </div>
  );
}
