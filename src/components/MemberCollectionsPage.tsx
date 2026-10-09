import { useMemo, useState } from "react";
import type { ManagedMember } from "../data/memberManagement";
import {
  dateToFinancialYear,
  financialYears,
  formatFinancialYear,
  parseRegisterDate,
  paymentTotals,
  type MemberPayment,
  type PaymentFields,
} from "../services/registerService";
import PaymentFormModal from "./expenses/PaymentFormModal";

interface MemberCollectionsPageProps {
  members: ManagedMember[];
  payments: MemberPayment[];
  cloudMode: boolean;
  onCreatePayment: (payment: PaymentFields) => Promise<void>;
}

type PaymentFilter = "All" | MemberPayment["status"];

function formatPaymentDate(value: string) {
  const date = parseRegisterDate(value);
  return date
    ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : value;
}

function formatAmount(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const filterOptions: PaymentFilter[] = ["All", "Paid", "Pending", "Failed"];

export default function MemberCollectionsPage({
  members,
  payments,
  cloudMode,
  onCreatePayment,
}: MemberCollectionsPageProps) {
  const [year, setYear] = useState<string>(financialYears[0]);
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>("All");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const yearPayments = useMemo(
    () => payments
      .filter((payment) => dateToFinancialYear(payment.date) === year)
      .sort((first, second) =>
        (parseRegisterDate(second.date)?.getTime() ?? 0) -
          (parseRegisterDate(first.date)?.getTime() ?? 0) ||
        second.id.localeCompare(first.id),
      ),
    [payments, year],
  );
  const filteredPayments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return yearPayments.filter((payment) => {
      if (statusFilter !== "All" && payment.status !== statusFilter) return false;
      if (!query) return true;

      const member = memberById.get(payment.memberId);
      return [
        member?.name ?? "",
        member?.id ?? payment.memberId,
        member?.accountNumber ?? "",
        member?.phone ?? "",
        payment.receiptId,
        payment.description,
        payment.paymentMode,
        payment.status,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [memberById, search, statusFilter, yearPayments]);
  const totals = paymentTotals(payments, year);

  async function savePayment(fields: PaymentFields) {
    setSaving(true);
    setNotice("");
    try {
      await onCreatePayment(fields);
      setFormOpen(false);
      setNotice("Collection record saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Finance</span><span>/</span><span className="text-blue-600">Collections</span>
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Member collections</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Record and review member payments separately from society expenses.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 sm:min-w-[190px]">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">Financial year</span>
            <select value={year} onChange={(event) => setYear(event.target.value)} className="form-control">
              {financialYears.map((item) => <option key={item} value={item}>FY {formatFinancialYear(item)}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={members.length === 0 || saving}
            onClick={() => setFormOpen(true)}
            className="action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Record collection
          </button>
        </div>
      </header>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {members.length === 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Add a member before recording a member collection.</p>}

      <section aria-label={`Collection totals for FY ${formatFinancialYear(year)}`} className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Paid collections", amount: totals.collected, note: "Payments marked paid in this financial year" },
          { label: "Pending collections", amount: totals.pending, note: "Payments awaiting collection" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(62,39,35,0.045)]">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-slate-900">{formatAmount(card.amount)}</p>
            <p className="mt-2 text-xs text-slate-400">{card.note}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="collections-register-title" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(62,39,35,0.055)]">
        <div className="grid gap-4 border-b border-slate-100 p-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_170px] lg:items-center">
          <div>
            <h3 id="collections-register-title" className="font-display text-base font-semibold text-slate-900">Collection register</h3>
            <p className="mt-1 text-xs text-slate-500">Member payment records for FY {formatFinancialYear(year)}</p>
          </div>
          <label className="min-w-0">
            <span className="sr-only">Search collections</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search member, receipt, or method"
              className="form-control"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by payment status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PaymentFilter)} className="form-control">
              {filterOptions.map((filter) => <option key={filter} value={filter}>{filter === "All" ? "All statuses" : filter}</option>)}
            </select>
          </label>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              {yearPayments.length === 0 ? `No collection records for FY ${formatFinancialYear(year)}.` : "No collections match these filters."}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {yearPayments.length === 0 ? "Record a member payment to start this year's collection register." : "Try a different search term or payment status."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.1em]">
                    <th scope="col" className="px-5 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Member</th>
                    <th scope="col" className="px-4 py-3">Receipt</th>
                    <th scope="col" className="px-4 py-3">Method</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const member = memberById.get(payment.memberId);
                    return (
                      <tr key={payment.id} className="border-t border-slate-100 text-sm">
                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatPaymentDate(payment.date)}</td>
                        <td className="px-4 py-3.5">
                          <span className="block font-medium text-slate-800">{member?.name ?? "Member record unavailable"}</span>
                          <span className="mt-0.5 block text-xs text-slate-400">{member?.id ?? payment.memberId}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{payment.receiptId || "—"}</td>
                        <td className="px-4 py-3.5 text-slate-600">{payment.paymentMode}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            payment.status === "Paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : payment.status === "Pending"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-rose-50 text-rose-700"
                          }`}>{payment.status}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-slate-800">{formatAmount(payment.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
              Showing {filteredPayments.length} of {yearPayments.length} collection records
            </div>
          </>
        )}
      </section>

      {formOpen && (
        <PaymentFormModal
          members={members}
          year={year}
          cloudMode={cloudMode}
          saving={saving}
          onClose={() => { if (!saving) setFormOpen(false); }}
          onSave={savePayment}
        />
      )}
    </div>
  );
}
