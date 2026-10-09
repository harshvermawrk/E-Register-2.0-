import type { ManagedMember } from "../data/memberManagement";
import type { ExpenseRecord } from "./expenseService";
import { loadLocalBatwaaraEntries, loadLocalBatwaaraYearAmounts, saveLocalBatwaaraEntry, saveLocalBatwaaraYearAmount, type BatwaaraEntry, type BatwaaraYearAmounts } from "./batwaaraService";
import { parseRegisterDate, type MemberPayment } from "./registerService";
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

type BatwaaraEntryRow = {
  id: string;
  register_year: number;
  member_id: string | null;
  person_name: string;
  amount: number | string | null;
  given: boolean;
  created_at: string;
};

const READ_PAGE_SIZE = 1000;

export interface CloudRegisterData {
  members: ManagedMember[];
  payments: MemberPayment[];
  expenses: ExpenseRecord[];
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function throwIfError(error: { code?: string; message: string } | null, operation: string) {
  if (!error) return;

  const guidance = error.code === "42501"
    ? "Your account does not have permission to make this change."
    : error.code === "42P01" || error.code === "PGRST205"
    ? "A required database table is not installed. Apply the current database migrations and try again."
    : error.code === "23505"
    ? "A record with one of these identifiers already exists. Refresh the register and try again."
    : error.code === "23503"
      ? "A related record could not be found. Refresh the register and try again."
      : error.code === "23514"
        ? "One or more values are invalid. Check the form and try again."
        : "Check your connection and admin access, then try again.";

  console.error(`[E-Register] ${operation} failed (database error ${error.code ?? "unknown"}).`);

  const wrapped = new Error(`${operation}. ${guidance}`) as Error & { code?: string };
  wrapped.code = error.code;
  throw wrapped;
}

async function loadAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>,
  operation: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + READ_PAGE_SIZE - 1);
    throwIfError(error, operation);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < READ_PAGE_SIZE) return rows;
  }
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

function batwaaraEntryToRow(entry: BatwaaraEntry) {
  return {
    id: entry.id,
    register_year: entry.year,
    member_id: entry.memberId,
    person_name: entry.name,
    amount: entry.amount,
    given: entry.given,
  };
}

function rowToBatwaaraEntry(row: BatwaaraEntryRow): BatwaaraEntry {
  return {
    id: row.id,
    year: row.register_year,
    memberId: row.member_id,
    name: row.person_name,
    amount: row.amount === null ? null : Number(row.amount),
    given: row.given,
    createdAt: row.created_at,
  };
}

async function readCloudRegister(): Promise<CloudRegisterData> {
  const client = requireSupabase();
  const [memberRows, paymentRows, expenseRows] = await Promise.all([
    loadAllRows<MemberRow>(
      (from, to) => client.from("members")
        .select("id,sno,account_number,name,initials,avatar_color,hometown,phone,email,status,join_date,entry_amount,archived_at")
        .is("archived_at", null)
        .order("sno")
        .order("id")
        .range(from, to),
      "Members could not be loaded",
    ),
    loadAllRows<PaymentRow>(
      (from, to) => client.from("payments")
        .select("id,member_id,payment_date,amount,payment_mode,status,receipt_id,description")
        .order("payment_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
      "Payments could not be loaded",
    ),
    loadAllRows<ExpenseRow>(
      (from, to) => client.from("expenses")
        .select("id,financial_year_start,period_id,title,amount,expense_date,notes,payment_mode,status,receipt_id")
        .is("archived_at", null)
        .order("expense_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
      "Expenses could not be loaded",
    ),
  ]);

  return {
    members: memberRows.map(rowToMember),
    payments: paymentRows.map(rowToPayment),
    expenses: expenseRows.map(rowToExpense),
  };
}

export async function loadCloudRegister(): Promise<CloudRegisterData> {
  return readCloudRegister();
}

export async function loadCloudBatwaaraEntries(): Promise<BatwaaraEntry[]> {
  const client = requireSupabase();

  try {
    const rows = await loadAllRows<BatwaaraEntryRow>(
      (from, to) => client.from("batwaara_entries")
        .select("id,register_year,member_id,person_name,amount,given,created_at")
        .order("created_at")
        .order("id")
        .range(from, to),
      "Batwaara entries could not be loaded",
    );

    return rows.map(rowToBatwaaraEntry);
  } catch (error) {
    if (isMissingTableError(error instanceof Error && "code" in error ? error as { code?: string } : null)) {
      console.warn("[E-Register] The Batwaara register table is missing; using local entries as a fallback.");
      return loadLocalBatwaaraEntries();
    }

    throw error;
  }
}

export async function saveCloudBatwaaraEntry(entry: BatwaaraEntry) {
  const client = requireSupabase();

  try {
    const { error } = await client
      .from("batwaara_entries")
      .upsert(batwaaraEntryToRow(entry), { onConflict: "id" });

    throwIfError(error, "Batwaara entry could not be saved");
  } catch (error) {
    if (isMissingTableError(error instanceof Error && "code" in error ? error as { code?: string } : null)) {
      console.warn("[E-Register] The Batwaara register table is missing; saving the entry locally instead.");
      saveLocalBatwaaraEntry(entry);
      return;
    }

    throw error;
  }
}

export async function loadCloudBatwaaraYearAmounts(): Promise<BatwaaraYearAmounts> {
  const client = requireSupabase();

  try {
    const { data, error } = await client
      .from("batwaara_year_settings")
      .select("register_year,amount")
      .order("register_year");

    throwIfError(error, "Batwaara yearly amounts could not be loaded");
    return Object.fromEntries((data ?? []).map((row) => [row.register_year, Number(row.amount)]));
  } catch (error) {
    if (isMissingTableError(error instanceof Error && "code" in error ? error as { code?: string } : null)) {
      console.warn("[E-Register] The Batwaara yearly settings table is missing; using local yearly amounts as a fallback.");
      return loadLocalBatwaaraYearAmounts();
    }

    throw error;
  }
}

export async function saveCloudBatwaaraYearAmount(year: number, amount: number): Promise<void> {
  const client = requireSupabase();

  try {
    const { error } = await client
      .from("batwaara_year_settings")
      .upsert({ register_year: year, amount }, { onConflict: "register_year" });

    throwIfError(error, "Batwaara yearly amount could not be saved");
  } catch (error) {
    if (isMissingTableError(error instanceof Error && "code" in error ? error as { code?: string } : null)) {
      console.warn("[E-Register] The Batwaara yearly settings table is missing; saving the yearly amount locally instead.");
      saveLocalBatwaaraYearAmount(year, amount);
      return;
    }

    throw error;
  }
}

export async function checkCloudReadAccess() {
  const client = requireSupabase();
  async function canReadTable(table: "members" | "payments" | "expenses") {
    try {
      const { error } = await client.from(table).select("id", { head: true }).limit(0);
      return error === null;
    } catch {
      return false;
    }
  }

  const [membersRead, paymentsRead, expensesRead] = await Promise.all([
    canReadTable("members"),
    canReadTable("payments"),
    canReadTable("expenses"),
  ]);

  return { membersRead, paymentsRead, expensesRead };
}

export async function createCloudMember(member: ManagedMember) {
  const client = requireSupabase();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: existingRows, error: readError } = await client
      .from("members")
      .select("id,sno,account_number,archived_at")
      .order("sno");
    throwIfError(readError, "Existing member identifiers could not be checked");

    const rows = existingRows ?? [];
    const usedIds = new Set(rows.map((row) => row.id));
    const usedAccountNumbers = new Set(rows.map((row) => row.account_number));
    let sno = rows.reduce((maximum, row) => Math.max(maximum, row.sno), 0) + 1;
    let id = `MF-${2400 + sno}`;
    let accountNumber = `6100${String(sno).padStart(6, "0")}`;

    while (usedIds.has(id) || usedAccountNumbers.has(accountNumber)) {
      sno += 1;
      id = `MF-${2400 + sno}`;
      accountNumber = `6100${String(sno).padStart(6, "0")}`;
    }

    const nextMember = { ...member, id, sno, accountNumber };
    const { error } = await client.from("members").insert(memberToRow(nextMember));
    if (!error) return nextMember;

    if (error.code !== "23505" || attempt === 2) {
      throwIfError(error, "Member could not be saved");
    }
  }

  throw new Error("Member could not be saved after retrying a member-number conflict. Refresh the register and try again.");
}

export async function createCloudMembersWithInitialPayments(members: ManagedMember[], payments: MemberPayment[]) {
  const { data, error } = await requireSupabase().rpc("create_yearwise_members_with_initial_payments", {
    p_members: members.map(memberToRow),
    p_payments: payments.map(paymentToRow),
  });
  throwIfError(error, "Unable to create members and initial payments. No changes were saved");

  return data as { member_ids: string[]; payment_ids: string[] };
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
  const activeRows = await loadAllRows<{ id: string }>(
    (from, to) => client.from("expenses")
      .select("id")
      .is("archived_at", null)
      .order("id")
      .range(from, to),
    "Existing expenses could not be checked",
  );

  if (expenses.length) {
    const saveResult = await client.from("expenses").upsert(expenses.map(expenseToRow), { onConflict: "id" });
    throwIfError(saveResult.error, "Expenses could not be saved");
  }

  const nextIds = new Set(expenses.map((expense) => expense.id));
  const removedIds = activeRows.map((row) => row.id).filter((id) => !nextIds.has(id));
  if (removedIds.length) {
    const archiveResult = await client.from("expenses")
      .update({ archived_at: new Date().toISOString() })
      .in("id", removedIds);
    throwIfError(archiveResult.error, "Deleted expenses could not be archived");
  }
}
