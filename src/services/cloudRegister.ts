import { initialManagedMembers, type ManagedMember } from "../data/memberManagement";
import { initialExpenses, type ExpenseRecord } from "./expenseService";
import { parseRegisterDate, type MemberPayment } from "./registerService";
import { members as sampleMembers, transactions as sampleTransactions } from "../data/mockData";
import { requireSupabase } from "./supabaseClient";

type MemberRow = {
  id: string;
  sno: number;
  account_number: string;
  name: string;
  initials: string;
  avatar_color: string;
  hometown: string;
  phone: string;
  email: string;
  status: ManagedMember["status"];
  join_date: string;
  entry_amount: number | string | null;
  archived_at: string | null;
};

type PaymentRow = {
  id: string;
  member_id: string;
  payment_date: string;
  amount: number | string;
  payment_mode: MemberPayment["paymentMode"];
  status: MemberPayment["status"];
  receipt_id: string;
  description: string;
};

type ExpenseRow = {
  id: string;
  financial_year_start: number;
  period_id: string;
  title: string;
  amount: number | string;
  expense_date: string;
  notes: string;
  payment_mode: ExpenseRecord["paymentMode"] | null;
  status: ExpenseRecord["status"];
  receipt_id: string | null;
};

export interface CloudRegisterData {
  members: ManagedMember[];
  payments: MemberPayment[];
  expenses: ExpenseRecord[];
}

function throwIfError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function toIsoDate(value: string) {
  const date = parseRegisterDate(value);
  if (!date) throw new Error(`Invalid date: ${value}`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function memberToRow(member: ManagedMember) {
  return {
    id: member.id,
    sno: member.sno,
    account_number: member.accountNumber,
    name: member.name,
    initials: member.initials,
    avatar_color: member.avatarColor,
    hometown: member.hometown,
    phone: member.phone,
    email: member.email,
    status: member.status,
    join_date: toIsoDate(member.joinDate),
    entry_amount: member.entryAmount ?? null,
  };
}

function paymentToRow(payment: MemberPayment) {
  return {
    id: payment.id,
    member_id: payment.memberId,
    payment_date: toIsoDate(payment.date),
    amount: payment.amount,
    payment_mode: payment.paymentMode,
    status: payment.status,
    receipt_id: payment.receiptId,
    description: payment.description,
  };
}

function expenseToRow(expense: ExpenseRecord) {
  return {
    id: expense.id,
    financial_year_start: expense.year,
    period_id: expense.periodId,
    title: expense.title,
    amount: expense.amount,
    expense_date: toIsoDate(expense.date),
    notes: expense.notes,
    payment_mode: expense.paymentMode ?? null,
    status: expense.status ?? "Paid",
    receipt_id: expense.receiptId ?? null,
  };
}

function rowToMember(row: MemberRow): ManagedMember {
  return {
    id: row.id,
    sno: row.sno,
    accountNumber: row.account_number,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatar_color,
    hometown: row.hometown,
    phone: row.phone,
    email: row.email,
    status: row.status,
    joinDate: row.join_date,
    entryAmount: row.entry_amount === null ? undefined : Number(row.entry_amount),
    outstandingAmount: 0,
    lastPaymentDate: "—",
  };
}

function rowToPayment(row: PaymentRow): MemberPayment {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.payment_date,
    amount: Number(row.amount),
    paymentMode: row.payment_mode,
    status: row.status,
    receiptId: row.receipt_id,
    description: row.description,
  };
}

function rowToExpense(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    year: row.financial_year_start,
    periodId: row.period_id,
    title: row.title,
    amount: Number(row.amount),
    date: row.expense_date,
    notes: row.notes,
    paymentMode: row.payment_mode ?? undefined,
    status: row.status,
    receiptId: row.receipt_id ?? undefined,
  };
}

async function readCloudRegister(): Promise<CloudRegisterData> {
  const client = requireSupabase();
  const [memberResult, paymentResult, expenseResult] = await Promise.all([
    client.from("members").select("*").is("archived_at", null).order("sno"),
    client.from("payments").select("*").order("payment_date", { ascending: false }),
    client.from("expenses").select("*").is("archived_at", null).order("expense_date", { ascending: false }),
  ]);
  throwIfError(memberResult.error, "Members could not be loaded");
  throwIfError(paymentResult.error, "Payments could not be loaded");
  throwIfError(expenseResult.error, "Expenses could not be loaded");

  return {
    members: (memberResult.data as MemberRow[]).map(rowToMember),
    payments: (paymentResult.data as PaymentRow[]).map(rowToPayment),
    expenses: (expenseResult.data as ExpenseRow[]).map(rowToExpense),
  };
}

async function seedSampleRegister() {
  const client = requireSupabase();
  const sampleEmailById = new Map(sampleMembers.map((member) => [member.id, member.email]));
  const membersWithEmail = initialManagedMembers.map((member) => ({ ...member, email: sampleEmailById.get(member.id) ?? "" }));
  const memberResult = await client.from("members").upsert(membersWithEmail.map(memberToRow), { onConflict: "id" });
  throwIfError(memberResult.error, "Sample members could not be created");

  const paymentResult = await client.from("payments").upsert(sampleTransactions.map((transaction) => paymentToRow({
    ...transaction,
    date: toIsoDate(transaction.date),
  })), { onConflict: "id" });
  throwIfError(paymentResult.error, "Sample payments could not be created");

  const expenseResult = await client.from("expenses").upsert(initialExpenses.map(expenseToRow), { onConflict: "id" });
  throwIfError(expenseResult.error, "Sample expenses could not be created");
}

export async function loadCloudRegister(): Promise<CloudRegisterData> {
  const data = await readCloudRegister();
  if (data.members.length || data.payments.length || data.expenses.length) return data;

  await seedSampleRegister();
  return readCloudRegister();
}

export async function createCloudMember(member: ManagedMember) {
  const { error } = await requireSupabase().from("members").insert(memberToRow(member));
  throwIfError(error, "Member could not be saved");
}

export async function createCloudMembers(members: ManagedMember[], payments: MemberPayment[]) {
  const client = requireSupabase();
  const memberResult = await client.from("members").insert(members.map(memberToRow));
  throwIfError(memberResult.error, "Year-wise members could not be saved");
  if (payments.length) {
    const paymentResult = await client.from("payments").insert(payments.map(paymentToRow));
    throwIfError(paymentResult.error, "Entry payments could not be saved");
  }
}

export async function updateCloudMember(member: ManagedMember) {
  const { data, error } = await requireSupabase()
    .from("members")
    .update(memberToRow(member))
    .eq("id", member.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  throwIfError(error, "Member changes could not be saved");
  if (!data) throw new Error("Member was not found in the cloud register.");
}

export async function archiveCloudMember(id: string) {
  const { data, error } = await requireSupabase()
    .from("members")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  throwIfError(error, "Member could not be archived");
  if (!data) throw new Error("Member was not found in the cloud register.");
}

export async function createCloudPayment(payment: MemberPayment) {
  const { error } = await requireSupabase().from("payments").insert(paymentToRow(payment));
  throwIfError(error, "Payment could not be saved");
}

export async function syncCloudExpenses(expenses: ExpenseRecord[]) {
  const client = requireSupabase();
  const activeResult = await client.from("expenses").select("id").is("archived_at", null);
  throwIfError(activeResult.error, "Existing expenses could not be checked");

  if (expenses.length) {
    const saveResult = await client.from("expenses").upsert(expenses.map(expenseToRow), { onConflict: "id" });
    throwIfError(saveResult.error, "Expenses could not be saved");
  }

  const nextIds = new Set(expenses.map((expense) => expense.id));
  const removedIds = (activeResult.data ?? []).map((row) => row.id as string).filter((id) => !nextIds.has(id));
  if (removedIds.length) {
    const archiveResult = await client.from("expenses")
      .update({ archived_at: new Date().toISOString() })
      .in("id", removedIds);
    throwIfError(archiveResult.error, "Deleted expenses could not be archived");
  }
}
