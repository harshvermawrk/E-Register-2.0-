export interface ExpensePeriod {
  id: string;
  name: string;
  dateRange: string;
}

export interface CollectionYear {
  id: number;
  label: string;
}

export interface ExpenseRecord {
  id: string;
  year: number;
  periodId: string;
  title: string;
  amount: number;
  date: string;
  notes: string;
  paymentMode?: "UPI" | "Cash" | "Bank Transfer" | "Cheque";
  status?: "Paid" | "Pending" | "Failed";
  receiptId?: string;
}

export type ExpenseFields = Omit<ExpenseRecord, "id">;

export interface ExpenseSummary {
  totalCollection: number;
  totalExpense: number;
  remainingBalance: number;
}

export const expensePeriods: ExpensePeriod[] = [
  { id: "period-1", name: "Period 1", dateRange: "April – June" },
  { id: "period-2", name: "Period 2", dateRange: "July – September" },
  { id: "period-3", name: "Period 3", dateRange: "October – December" },
  { id: "period-4", name: "Period 4", dateRange: "January – March" },
];

export const collectionYears: CollectionYear[] = [
  { id: 2026, label: "2026–27" },
  { id: 2025, label: "2025–26" },
  { id: 2024, label: "2024–25" },
  { id: 2023, label: "2023–24" },
  { id: 2022, label: "2022–23" },
];

export const initialExpenses: ExpenseRecord[] = [
  { id: "expense-2026-1", year: 2026, periodId: "period-1", title: "Community hall repairs", amount: 15_000, date: "2026-04-18", notes: "Paint and minor electrical work" },
  { id: "expense-2026-2", year: 2026, periodId: "period-1", title: "Garden maintenance", amount: 10_000, date: "2026-06-12", notes: "" },
  { id: "expense-2026-3", year: 2026, periodId: "period-2", title: "Water tank cleaning", amount: 12_000, date: "2026-07-22", notes: "Annual cleaning service" },
  { id: "expense-2026-4", year: 2026, periodId: "period-2", title: "Security equipment", amount: 6_000, date: "2026-09-08", notes: "" },
  { id: "expense-2026-5", year: 2026, periodId: "period-3", title: "Festival arrangements", amount: 20_000, date: "2026-10-26", notes: "Lighting and decorations" },
  { id: "expense-2026-6", year: 2026, periodId: "period-3", title: "Community event supplies", amount: 12_000, date: "2026-12-04", notes: "" },
  { id: "expense-2026-7", year: 2026, periodId: "period-4", title: "Common-area electricity", amount: 13_000, date: "2027-01-16", notes: "Quarterly utility bill" },
  { id: "expense-2026-8", year: 2026, periodId: "period-4", title: "Safety inspection", amount: 7_000, date: "2027-03-05", notes: "" },
  { id: "expense-2025-1", year: 2025, periodId: "period-1", title: "Lift servicing", amount: 18_000, date: "2025-05-11", notes: "Preventive maintenance" },
  { id: "expense-2025-2", year: 2025, periodId: "period-1", title: "Garden supplies", amount: 4_500, date: "2025-06-19", notes: "" },
  { id: "expense-2025-3", year: 2025, periodId: "period-2", title: "Water pump replacement", amount: 23_000, date: "2025-08-14", notes: "" },
  { id: "expense-2025-4", year: 2025, periodId: "period-3", title: "Year-end gathering", amount: 16_000, date: "2025-11-22", notes: "" },
  { id: "expense-2024-1", year: 2024, periodId: "period-2", title: "Gate maintenance", amount: 8_500, date: "2024-08-09", notes: "Repairs and repainting" },
];

const STORAGE_KEY = "e-register.expenses.v1";
const periodIds = new Set(expensePeriods.map((period) => period.id));
const yearIds = new Set(collectionYears.map((year) => year.id));

class ExpenseStorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ExpenseStorageError";
    this.cause = cause;
  }
}

function isExpenseRecord(value: unknown): value is ExpenseRecord {
  if (typeof value !== "object" || value === null) return false;
  const expense = value as Record<string, unknown>;
  return typeof expense.id === "string"
    && typeof expense.year === "number"
    && yearIds.has(expense.year)
    && typeof expense.periodId === "string"
    && periodIds.has(expense.periodId)
    && typeof expense.title === "string"
    && typeof expense.amount === "number"
    && Number.isFinite(expense.amount)
    && expense.amount > 0
    && typeof expense.date === "string"
    && typeof expense.notes === "string";
}

export function loadExpenses(): ExpenseRecord[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === null) return initialExpenses;

  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch (error) {
    throw new ExpenseStorageError("Saved expense data could not be read. Clear the expense data in local storage to continue.", error);
  }

  if (!Array.isArray(parsed) || !parsed.every(isExpenseRecord)) {
    throw new ExpenseStorageError("Saved expense data is invalid. Clear the expense data in local storage to continue.");
  }

  return parsed;
}

export function saveExpenses(expenses: ExpenseRecord[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function calculateExpenseSummary(expenses: ExpenseRecord[], year: number, collection: number): ExpenseSummary {
  const totalCollection = collection;
  const totalExpense = expenses
    .filter((expense) => expense.year === year)
    .reduce((total, expense) => total + expense.amount, 0);

  return {
    totalCollection,
    totalExpense,
    remainingBalance: totalCollection - totalExpense,
  };
}

export function calculatePeriodExpense(expenses: ExpenseRecord[], year: number, periodId: string): number {
  return expenses
    .filter((expense) => expense.year === year && expense.periodId === periodId)
    .reduce((total, expense) => total + expense.amount, 0);
}

export function createExpense(expenses: ExpenseRecord[], fields: ExpenseFields): ExpenseRecord[] {
  return [...expenses, { ...fields, id: crypto.randomUUID() }];
}

export function updateExpense(expenses: ExpenseRecord[], id: string, fields: ExpenseFields): ExpenseRecord[] {
  return expenses.map((expense) => expense.id === id ? { ...fields, id } : expense);
}

export function deleteExpense(expenses: ExpenseRecord[], id: string): ExpenseRecord[] {
  return expenses.filter((expense) => expense.id !== id);
}

export function formatExpenseCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
