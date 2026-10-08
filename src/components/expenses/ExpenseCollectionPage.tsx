import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { ManagedMember } from "../../data/memberManagement";
import { formatMemberDate } from "../../data/memberManagement";
import { dateToFinancialYear, financialYearForStartYear, formatFinancialYear, paymentTotals, type MemberPayment, type PaymentFields } from "../../services/registerService";
import ExpenseFormModal from "./ExpenseFormModal";
import PaymentFormModal from "./PaymentFormModal";
import ExpensePeriodCard from "./ExpensePeriodCard";
import ExpenseSummary from "./ExpenseSummary";
import {
  calculateExpenseSummary,
  calculatePeriodExpense,
  collectionYears,
  createExpense,
  deleteExpense,
  expensePeriods,
  formatExpenseCurrency,
  initialExpenses,
  loadExpenses,
  saveExpenses,
  updateExpense,
  type ExpenseFields,
  type ExpenseRecord,
} from "../../services/expenseService";

interface ExpenseStatus {
  kind: "success" | "error";
  message: string;
}

interface ExpenseCollectionPageProps {
  members: ManagedMember[];
  payments: MemberPayment[];
  onCreatePayment: (payment: PaymentFields) => void;
  onExpensesChange: (expenses: ExpenseRecord[]) => void;
  savedExpenses: ExpenseRecord[];
  cloudMode: boolean;
  onSaveCloudExpenses: (expenses: ExpenseRecord[]) => Promise<void>;
}

function loadInitialExpenses(cloudMode: boolean, savedExpenses: ExpenseRecord[]): { expenses: ExpenseRecord[]; error: string } {
  if (cloudMode) return { expenses: savedExpenses, error: "" };
  try {
    return { expenses: loadExpenses(), error: "" };
  } catch (error) {
    return {
      expenses: initialExpenses,
      error: error instanceof Error ? error.message : "Saved expenses could not be loaded.",
    };
  }
}

export default function ExpenseCollectionPage({ members, payments, onCreatePayment, onExpensesChange, savedExpenses, cloudMode, onSaveCloudExpenses }: ExpenseCollectionPageProps) {
  const [initialData] = useState(() => loadInitialExpenses(cloudMode, savedExpenses));
  const [expenses, setExpenses] = useState(initialData.expenses);
  const [storageError, setStorageError] = useState(initialData.error);
  const [selectedYear, setSelectedYear] = useState(collectionYears[0].id);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedPeriods, setExpandedPeriods] = useState<string[]>([expensePeriods[0].id]);
  const [formPeriod, setFormPeriod] = useState<string | null>(null);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);
  const [status, setStatus] = useState<ExpenseStatus | null>(initialData.error ? { kind: "error", message: initialData.error } : null);
  const skippedInitialCloudSave = useRef(false);

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
        .then(() => setStorageError(""))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Cloud test expenses could not be saved.";
          setStorageError(message);
          setStatus({ kind: "error", message: `The change is shown for this session but was not saved to the cloud test database: ${message}` });
        });
      return;
    }
    if (initialData.error) return;
    try {
      saveExpenses(expenses);
      setStorageError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Expenses could not be saved in this browser.";
      setStorageError(message);
      setStatus({ kind: "error", message: `Changes are available for this session but could not be saved: ${message}` });
    }
  }, [expenses, initialData.error, cloudMode, onSaveCloudExpenses]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const selectedYearInfo = collectionYears.find((year) => year.id === selectedYear) ?? collectionYears[0];
  const yearLabel = selectedYearInfo.label;
  const collection = paymentTotals(payments, financialYearForStartYear(selectedYear));
  const summary = useMemo(() => calculateExpenseSummary(expenses, selectedYear, collection.collected), [expenses, selectedYear, collection.collected]);
  const yearPayments = useMemo(() => payments
    .filter((payment) => dateToFinancialYear(payment.date) === financialYearForStartYear(selectedYear))
    .sort((first, second) => second.date.localeCompare(first.date)), [payments, selectedYear]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return expenses
      .filter((expense) => expense.year === selectedYear)
      .filter((expense) => selectedPeriod === "all" || expense.periodId === selectedPeriod)
      .filter((expense) => !query || expense.title.toLocaleLowerCase().includes(query))
      .sort((first, second) => second.date.localeCompare(first.date));
  }, [expenses, search, selectedPeriod, selectedYear]);
  const hasNoSearchResults = search.trim().length > 0 && filteredExpenses.length === 0;

  function togglePeriod(periodId: string) {
    setExpandedPeriods((current) => current.includes(periodId)
      ? current.filter((item) => item !== periodId)
      : [...current, periodId]);
  }

  function beginAdd(periodId: string) {
    setEditingExpense(null);
    setFormPeriod(periodId);
    setSelectedPeriod("all");
    setSearch("");
    setExpandedPeriods((current) => current.includes(periodId) ? current : [...current, periodId]);
  }

  function saveExpense(fields: ExpenseFields) {
    setExpandedPeriods((current) => current.includes(fields.periodId) ? current : [...current, fields.periodId]);
    if (editingExpense) {
      setExpenses((current) => updateExpense(current, editingExpense.id, fields));
      setStatus({ kind: "success", message: "Expense updated." });
    } else {
      setExpenses((current) => createExpense(current, fields));
      setStatus({ kind: "success", message: "Expense added." });
    }
    setFormPeriod(null);
    setEditingExpense(null);
  }

  function confirmDelete() {
    if (!deletingExpense) return;
    setExpenses((current) => deleteExpense(current, deletingExpense.id));
    setStatus({ kind: "success", message: `${deletingExpense.title} was deleted.` });
    setDeletingExpense(null);
  }

  function exportFinance() {
    const workbook = XLSX.utils.book_new();
    const paymentRows = yearPayments.map((payment) => ({
      "Financial year": financialYearForStartYear(selectedYear),
      Member: memberNames.get(payment.memberId) ?? payment.memberId,
      Date: formatMemberDate(payment.date),
      Description: payment.description,
      Amount: payment.amount,
      Method: payment.paymentMode,
      Status: payment.status,
      Receipt: payment.receiptId,
    }));
    const expenseRows = expenses.filter((expense) => expense.year === selectedYear).map((expense) => ({
      "Financial year": financialYearForStartYear(selectedYear),
      Expense: expense.title,
      Date: expense.date,
      Amount: expense.amount,
      Notes: expense.notes,
      Method: expense.paymentMode ?? "",
      Status: expense.status ?? "Paid",
      Receipt: expense.receiptId ?? "",
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentRows), "Collections");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseRows), "Expenses");
    XLSX.writeFile(workbook, `finance-${financialYearForStartYear(selectedYear)}.xlsx`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400"><span>Finance</span><span>/</span><span className="text-blue-600">Expenses &amp; Collection</span></p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Expenses &amp; Collection</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{cloudMode ? "Cloud test finance register" : "Demo finance register"} · review member receipts, track expenses, and see the balance calculated from recorded transactions.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 sm:min-w-[190px]">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">Financial year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="form-control">
              {collectionYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setPaymentFormOpen(true)} className="action-button border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700">+ Record payment</button>
          <button type="button" onClick={() => beginAdd(expensePeriods[0].id)} className="action-button border-blue-600 bg-blue-600 text-white shadow-sm hover:border-blue-700 hover:bg-blue-700">+ Add expense</button>
          <button type="button" onClick={exportFinance} className="action-button border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Export FY report</button>
        </div>
      </header>

      {status && (
        <div role={status.kind === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${status.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          <span>{status.message}</span>
          <button type="button" onClick={() => setStatus(null)} aria-label="Dismiss message" className="focus-ring rounded px-1 font-semibold">×</button>
        </div>
      )}
      {storageError && !status && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{storageError}</p>}

      <ExpenseSummary summary={summary} yearLabel={yearLabel} />

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h3 className="font-display text-base font-semibold text-slate-900">Member collections <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-xs font-semibold text-slate-500">{yearPayments.length}</span></h3><p className="mt-1 text-xs text-slate-400">Paid, pending, and failed payment records for FY {formatFinancialYear(financialYearForStartYear(selectedYear))}.</p></div><p className="text-sm font-semibold text-slate-700">Paid {formatExpenseCurrency(collection.collected)} · Pending {formatExpenseCurrency(collection.pending)}</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3">Date</th><th className="px-5 py-3">Member / description</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Method / status</th><th className="px-6 py-3">Receipt</th></tr></thead><tbody>{yearPayments.map((payment) => <tr key={payment.id} className="border-t border-slate-100 text-sm"><td className="px-6 py-3.5">{formatMemberDate(payment.date)}</td><td className="px-5 py-3.5"><span className="block font-medium text-slate-800">{memberNames.get(payment.memberId) ?? payment.memberId}</span><span className="text-xs text-slate-400">{payment.description}</span></td><td className="px-5 py-3.5 text-right font-semibold">{formatExpenseCurrency(payment.amount)}</td><td className="px-5 py-3.5">{payment.paymentMode} · <span className={payment.status === "Paid" ? "text-emerald-700" : payment.status === "Pending" ? "text-amber-700" : "text-rose-700"}>{payment.status}</span></td><td className="px-6 py-3.5">{payment.receiptId || "—"}</td></tr>)}{yearPayments.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">No member payments recorded in this financial year yet.</td></tr>}</tbody></table></div>
      </section>

      <section aria-labelledby="expense-periods-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.035)] sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <h3 id="expense-periods-title" className="font-display text-lg font-semibold text-slate-900">Expense periods</h3>
            <p className="mt-1 text-sm text-slate-500">Four periods for the {yearLabel} financial year.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 sm:min-w-[180px]">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Filter by period</span>
              <select value={selectedPeriod} onChange={(event) => {
                const periodId = event.target.value;
                setSelectedPeriod(periodId);
                setExpandedPeriods([periodId === "all" ? expensePeriods[0].id : periodId]);
              }} className="form-control min-h-10">
                <option value="all">All periods</option>
                {expensePeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
              </select>
            </label>
            <label className="min-w-0 sm:min-w-[230px]">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Search expenses</span>
              <input type="search" value={search} onChange={(event) => {
                const value = event.target.value;
                const query = value.trim().toLocaleLowerCase();
                setSearch(value);
                if (query) {
                  const matchingPeriods = expenses
                    .filter((expense) => expense.year === selectedYear)
                    .filter((expense) => selectedPeriod === "all" || expense.periodId === selectedPeriod)
                    .filter((expense) => expense.title.toLocaleLowerCase().includes(query))
                    .map((expense) => expense.periodId);
                  setExpandedPeriods([...new Set(matchingPeriods)]);
                } else {
                  setExpandedPeriods([selectedPeriod === "all" ? expensePeriods[0].id : selectedPeriod]);
                }
              }} placeholder="Expense name..." className="form-control min-h-10" />
            </label>
          </div>
        </div>

        {hasNoSearchResults ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.035)]">
            <p className="text-sm font-semibold text-slate-700">No expenses match “{search.trim()}”.</p>
            <p className="mt-1 text-sm text-slate-400">Try a different expense name or clear the search.</p>
            <button type="button" onClick={() => setSearch("")} className="focus-ring mt-4 rounded-lg px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50">Clear search</button>
          </div>
        ) : expensePeriods
          .filter((period) => selectedPeriod === "all" || selectedPeriod === period.id)
          .map((period) => {
            const periodExpenses = filteredExpenses.filter((expense) => expense.periodId === period.id);
            const total = calculatePeriodExpense(expenses, selectedYear, period.id);
            return (
              <ExpensePeriodCard
                key={period.id}
                period={period}
                expenses={periodExpenses}
                total={total}
                expanded={expandedPeriods.includes(period.id)}
                search={search}
                onToggle={() => togglePeriod(period.id)}
                onAdd={() => beginAdd(period.id)}
                onEdit={(expense) => { setEditingExpense(expense); setFormPeriod(expense.periodId); }}
                onDelete={setDeletingExpense}
              />
            );
          })}
      </section>

      {formPeriod && (
        <ExpenseFormModal
          key={editingExpense?.id ?? formPeriod}
          year={selectedYear}
          periods={expensePeriods}
          expense={editingExpense ?? undefined}
          onClose={() => { setFormPeriod(null); setEditingExpense(null); }}
          onSave={saveExpense}
        />
      )}
      {paymentFormOpen && <PaymentFormModal members={members} year={financialYearForStartYear(selectedYear)} cloudMode={cloudMode} onClose={() => setPaymentFormOpen(false)} onSave={(payment) => {
        onCreatePayment(payment);
        setPaymentFormOpen(false);
        setStatus({ kind: "success", message: cloudMode ? "Member payment submitted to the cloud test register." : "Member payment saved to the demo register." });
      }} />}

      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-expense-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-lg font-bold text-rose-600">!</span>
            <h2 id="delete-expense-title" className="mt-4 font-display text-lg font-semibold text-slate-900">Delete this expense?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">“{deletingExpense.title}” ({formatExpenseCurrency(deletingExpense.amount)}) will be removed from this year’s records.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeletingExpense(null)} className="action-button border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={confirmDelete} className="action-button border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700">Delete expense</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
