import * as XLSX from "xlsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ExpensePeriodCard from "./ExpensePeriodCard";
import ExpenseSummary from "./ExpenseSummary";
import {
  calculateExpenseSummary,
  calculatePeriodExpense,
  collectionYears,
  expensePeriods,
  formatExpenseCurrency,
  type ExpenseRecord,
} from "../../services/expenseService";

interface ExpenseCollectionPageProps {
  savedExpenses: ExpenseRecord[];
}

export default function ExpenseCollectionPage({ savedExpenses }: ExpenseCollectionPageProps) {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(collectionYears[0].id);
  const selectedYearInfo = collectionYears.find((year) => year.id === selectedYear) ?? collectionYears[0];
  const summary = calculateExpenseSummary(savedExpenses, selectedYear);

  function exportFinance() {
    const rows = savedExpenses
      .filter((expense) => expense.year === selectedYear)
      .map((expense) => ({
        "Financial year": selectedYearInfo.label,
        Period: expensePeriods.find((period) => period.id === expense.periodId)?.name ?? expense.periodId,
        Expense: expense.title,
        Date: expense.date,
        Amount: expense.amount,
        Notes: expense.notes,
      }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Expenses");
    XLSX.writeFile(workbook, `expenses-${selectedYear}.xlsx`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400"><span>Finance</span><span>/</span><span className="text-blue-600">Expenses</span></p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Expenses</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Choose a period to review and manage its expense records.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 sm:min-w-[190px]">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">Financial year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="form-control">
              {collectionYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={exportFinance} className="action-button border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Export expense report</button>
        </div>
      </header>

      <ExpenseSummary summary={summary} yearLabel={selectedYearInfo.label} />

      <section aria-labelledby="expense-periods-title" className="flex flex-col gap-4">
        <div>
          <h3 id="expense-periods-title" className="font-display text-lg font-semibold text-slate-900">Expense periods</h3>
          <p className="mt-1 text-sm text-slate-500">Four periods for the {selectedYearInfo.label} financial year.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {expensePeriods.map((period) => {
            const periodExpenses = savedExpenses.filter((expense) => expense.year === selectedYear && expense.periodId === period.id);
            const total = calculatePeriodExpense(savedExpenses, selectedYear, period.id);
            return (
              <ExpensePeriodCard
                key={period.id}
                period={period}
                expenses={periodExpenses}
                total={total}
                onOpen={() => navigate(`/expenses-collection/${selectedYear}/${period.id}`)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
