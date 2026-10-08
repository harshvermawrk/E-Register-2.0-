import { members, type Member } from "./mockData";
import { dateToFinancialYear, financialYears, parseRegisterDate, type MemberPayment } from "../services/registerService";

export { financialYears };
export type ManagedMember = Member & { accountNumber: string; entryAmount?: number };

export type MemberFields = Pick<Member, "name" | "hometown" | "phone" | "joinDate" | "status">;
export type YearWiseEntryFields = Pick<Member, "name" | "joinDate"> & { amount: number };

export const annualMembershipFee = 12000;

export const initialManagedMembers: ManagedMember[] = members.map((member) => ({
  ...member,
  accountNumber: `6100${String(member.sno).padStart(6, "0")}`,
}));

export function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function parseMemberDate(value: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return date.getFullYear() === Number(isoMatch[1]) && date.getMonth() === Number(isoMatch[2]) - 1 && date.getDate() === Number(isoMatch[3]) ? date : null;
  }

  const localizedMatch = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value);
  if (localizedMatch) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(localizedMatch[2].toLowerCase());
    if (month < 0) return null;
    const date = new Date(Number(localizedMatch[3]), month, Number(localizedMatch[1]));
    return date.getFullYear() === Number(localizedMatch[3]) && date.getMonth() === month && date.getDate() === Number(localizedMatch[1]) ? date : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getMemberEntryYear(value: string) {
  const year = dateToFinancialYear(value);
  return year ? Number(year.slice(0, 4)) : null;
}

export function formatMemberDate(value: string) {
  const date = parseMemberDate(value);
  return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : value;
}

export function toDateInput(value: string) {
  const date = parseRegisterDate(value) ?? new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function memberFinancials(member: ManagedMember, year: string, payments: MemberPayment[] = []) {
  const memberYear = dateToFinancialYear(member.joinDate);
  const eligible = memberYear !== null && Number(memberYear.slice(0, 4)) <= Number(year.slice(0, 4));
  const yearlyPayments = payments
    .filter((payment) => payment.memberId === member.id && dateToFinancialYear(payment.date) === year)
    .sort((first, second) => (parseRegisterDate(first.date)?.getTime() ?? 0) - (parseRegisterDate(second.date)?.getTime() ?? 0));
  const paid = yearlyPayments.filter((payment) => payment.status === "Paid").reduce((total, payment) => total + payment.amount, 0);
  const paidPayments = yearlyPayments.filter((payment) => payment.status === "Paid");
  const due = eligible ? Math.max(0, annualMembershipFee - paid) : 0;
  const paymentCount = yearlyPayments.length;
  const startYear = Number(year.slice(0, 4));
  let balance = 0;
  const statement = Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (index + 3) % 12;
    const dateYear = monthIndex >= 3 ? startYear : startYear + 1;
    const credit = paidPayments
      .filter((payment) => {
        const date = parseRegisterDate(payment.date);
        return date?.getFullYear() === dateYear && date.getMonth() === monthIndex;
      })
      .reduce((total, payment) => total + payment.amount, 0);
    const monthlyDue = eligible ? annualMembershipFee / 12 : 0;
    balance = Math.max(0, balance + monthlyDue - credit);
    const date = credit > 0
      ? paidPayments.find((payment) => {
        const paymentDate = parseRegisterDate(payment.date);
        return paymentDate?.getFullYear() === dateYear && paymentDate.getMonth() === monthIndex;
      })?.date ?? "—"
      : "—";
    return { sno: index + 1, date, credit, due: monthlyDue, balance };
  });

  return { paid, due, paymentCount, statement, payments: yearlyPayments };
}

export function createManagedMember(fields: MemberFields, sno: number, entryAmount?: number): ManagedMember {
  const idNumber = 2400 + sno;
  const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#0891B2", "#BE185D"];
  const initials = fields.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return {
    ...fields,
    id: `MF-${idNumber}`,
    sno,
    initials,
    avatarColor: palette[(sno - 1) % palette.length],
    accountNumber: `6100${String(sno).padStart(6, "0")}`,
    entryAmount,
    outstandingAmount: 0,
    lastPaymentDate: "—",
    email: "",
  };
}
