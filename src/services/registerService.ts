import { transactions, type PaymentMode, type PaymentStatus, type Transaction } from "../data/mockData";

export const financialYears = ["2026-27", "2025-26", "2024-25", "2023-24", "2022-23"] as const;
export type FinancialYear = string;
export type MemberPayment = Transaction;
export type PaymentFields = Omit<MemberPayment, "id">;

const STORAGE_KEY = "e-register.payments.v1";

export function parseRegisterDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date.getFullYear() === Number(iso[1]) && date.getMonth() === Number(iso[2]) - 1 && date.getDate() === Number(iso[3]) ? date : null;
  }
  const localized = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value);
  if (localized) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(localized[2].toLowerCase());
    if (month < 0) return null;
    const date = new Date(Number(localized[3]), month, Number(localized[1]));
    return date.getFullYear() === Number(localized[3]) && date.getMonth() === month && date.getDate() === Number(localized[1]) ? date : null;
  }
  return null;
}

export function dateToFinancialYear(value: string): string | null {
  const date = parseRegisterDate(value);
  if (!date) return null;
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function financialYearForStartYear(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}

export function financialYearMonths(year: string) {
  const start = Number(year.slice(0, 4));
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start, index + 3, 1);
    return { month: date.toLocaleDateString("en", { month: "short" }), year: date.getFullYear(), monthIndex: date.getMonth() };
  });
}

function isPayment(value: unknown): value is MemberPayment {
  if (typeof value !== "object" || value === null) return false;
  const payment = value as Record<string, unknown>;
  return typeof payment.id === "string"
    && typeof payment.memberId === "string"
    && typeof payment.date === "string"
    && parseRegisterDate(payment.date) !== null
    && typeof payment.amount === "number"
    && Number.isFinite(payment.amount)
    && payment.amount > 0
    && ["UPI", "Cash", "Bank Transfer", "Cheque"].includes(String(payment.paymentMode))
    && ["Paid", "Pending", "Failed"].includes(String(payment.status))
    && typeof payment.receiptId === "string"
    && typeof payment.description === "string";
}

export function loadPayments(): MemberPayment[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === null) return transactions;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch (error) {
    console.error("Saved payment data could not be read.", error);
    throw new Error("Saved payment data could not be read. Clear payment data in local storage to continue.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isPayment)) {
    throw new Error("Saved payment data is invalid. Clear payment data in local storage to continue.");
  }
  return parsed;
}

export function savePayments(payments: MemberPayment[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
}

export function createPayment(payments: MemberPayment[], fields: PaymentFields): MemberPayment[] {
  const id = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return [...payments, { ...fields, id }];
}

export function paymentTotals(payments: MemberPayment[], year: FinancialYear) {
  return payments.filter((payment) => dateToFinancialYear(payment.date) === year).reduce((totals, payment) => {
    if (payment.status === "Paid") totals.collected += payment.amount;
    if (payment.status === "Pending") totals.pending += payment.amount;
    return totals;
  }, { collected: 0, pending: 0 });
}

export function monthlyPaymentTotals(payments: MemberPayment[], year: FinancialYear) {
  const months = financialYearMonths(year);
  return months.map(({ month, year: calendarYear, monthIndex }) => ({
    month,
    amount: payments.filter((payment) => {
      const date = parseRegisterDate(payment.date);
      return payment.status === "Paid" && date?.getFullYear() === calendarYear && date.getMonth() === monthIndex;
    }).reduce((total, payment) => total + payment.amount, 0),
  }));
}

export function formatFinancialYear(year: string) {
  return year.replace("-", "–");
}

export type { PaymentMode, PaymentStatus };
