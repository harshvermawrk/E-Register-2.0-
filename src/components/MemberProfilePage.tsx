import { useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import type { ManagedMember, MemberFields } from "../data/memberManagement";
import { financialYears, formatCurrency, formatMemberDate, getMemberEntryYear, memberFinancials } from "../data/memberManagement";
import type { MemberPayment } from "../services/registerService";
import MemberFormModal from "./MemberFormModal";

interface MemberProfilePageProps {
  members: ManagedMember[];
  payments: MemberPayment[];
  onUpdate: (id: string, fields: MemberFields) => void;
  onDelete: (id: string) => void;
  backToYearWise?: boolean;
}

function ActionIcon({ kind }: { kind: "edit" | "delete" | "print" | "download" | "back" }) {
  const shapes: Record<typeof kind, ReactNode> = {
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></>,
    delete: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M20 12H9" /></>,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[kind]}</svg>;
}

export default function MemberProfilePage({ members, payments, onUpdate, onDelete, backToYearWise = false }: MemberProfilePageProps) {
  const { memberId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedYear = searchParams.get("year");
  const year = financialYears.includes(requestedYear as (typeof financialYears)[number]) ? requestedYear as (typeof financialYears)[number] : financialYears[0];
  const [editing, setEditing] = useState(false);
  const member = members.find((item) => item.id.toLowerCase() === decodeURIComponent(memberId).toLowerCase());

  if (!member) {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><p className="font-display text-2xl font-semibold text-slate-900">Member not found</p><p className="mt-2 text-sm text-slate-500">This member may have been removed from the register.</p><button onClick={() => navigate(backToYearWise ? "/year-wise-list" : "/members")} className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{backToYearWise ? "Back to Year Wise List" : "Back to members"}</button></div>;
  }

  const financials = memberFinancials(member, year, payments);
  const profileMemberId = member.id;
  const entryYear = getMemberEntryYear(member.joinDate);
  const returnToList = () => navigate(backToYearWise ? `/year-wise-list?year=${entryYear ?? new Date().getFullYear()}` : "/members");

  const removeMember = () => {
    if (window.confirm(`Delete ${member.name} from the member register?`)) {
      onDelete(member.id);
      navigate("/members", { replace: true });
    }
  };

  function printProfile() {
    window.print();
  }

  function exportPassbook() {
    const rows = financials.payments.map((payment) => ({
      "Financial year": year,
      Date: formatMemberDate(payment.date),
      Description: payment.description,
      Amount: payment.amount,
      Method: payment.paymentMode,
      Status: payment.status,
      Receipt: payment.receiptId,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Passbook");
    XLSX.writeFile(workbook, `${profileMemberId}-passbook-${year}.xlsx`);
  }

  return (
    <div className="print-profile mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><button onClick={returnToList} className="inline-flex items-center gap-1.5 hover:text-blue-600"><ActionIcon kind="back" /> {backToYearWise ? "Back to Year Wise List" : "Members"}</button><span>/</span><span className="text-slate-600">Member profile</span></div>
        <div className="member-profile-actions flex flex-wrap items-center gap-2"><button onClick={() => setEditing(true)} className="action-button border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ActionIcon kind="edit" /> Edit</button><button onClick={removeMember} className="action-button border-rose-100 bg-white text-rose-600 hover:bg-rose-50"><ActionIcon kind="delete" /> Delete</button><button onClick={printProfile} className="action-button border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><ActionIcon kind="print" /> Print / Save as PDF</button><button onClick={exportPassbook} className="action-button border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700"><ActionIcon kind="download" /> Export passbook</button></div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.045)]">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#10264A] via-[#173D72] to-[#2464B5] px-6 py-7 text-white sm:px-8 sm:py-8">
          <div className="absolute -right-8 -top-28 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -right-2 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div role="img" aria-label={`${member.name} initials`} className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl border-2 border-white/60 text-xl font-semibold text-white shadow-lg ring-4 ring-white/10" style={{ background: `linear-gradient(145deg, ${member.avatarColor}, #10264A)` }}>{member.initials}</div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Membership passbook</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{member.name}</h2><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-blue-100"><span>Member ID <b className="font-semibold text-white">{member.id}</b></span><span className="hidden text-white/40 sm:inline">•</span><span>Account <b className="font-semibold text-white">{member.accountNumber}</b></span></div></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Phone number", value: member.phone, icon: "phone" },
            { label: "City", value: member.hometown, icon: "pin" },
            { label: "Date of entry", value: formatMemberDate(member.joinDate), icon: "calendar" },
            { label: "Entry year", value: entryYear?.toString() ?? "—", icon: "calendar" },
            { label: "Total credit", value: formatCurrency(member.entryAmount ?? financials.paid), icon: "credit" },
            { label: "Member ID", value: member.id, icon: "id" },
          ].map((item) => <div key={item.label} className="bg-white px-5 py-4 sm:px-7"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</p><p className="mt-1.5 truncate text-sm font-semibold text-slate-800">{item.value}</p></div>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-6"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-base font-semibold text-slate-900">Account statement</h3><label className="sr-only" htmlFor="passbook-year">Passbook financial year</label><select id="passbook-year" value={year} onChange={(event) => setSearchParams({ year: event.target.value })} className="form-control min-h-8 w-auto py-1 text-xs">{financialYears.map((item) => <option key={item} value={item}>FY {item.replace("-", "–")}</option>)}</select></div><p className="mt-1 text-xs text-slate-400">Payments recorded for this financial year (April–March)</p></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-blue-500" /> Passbook ledger</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left"><thead><tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3.5">S.No</th><th className="px-5 py-3.5">Date of credit</th><th className="px-5 py-3.5 text-right">Amount of credit</th><th className="px-5 py-3.5 text-right">Amount due</th><th className="px-6 py-3.5 text-right">Balance</th></tr></thead><tbody>{financials.statement.map((row) => <tr key={row.sno} className="border-t border-slate-100 text-sm transition-colors hover:bg-blue-50/40"><td className="px-6 py-3.5 text-xs tabular-nums text-slate-400">{String(row.sno).padStart(2, "0")}</td><td className="px-5 py-3.5 font-medium text-slate-700">{row.date}</td><td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-800">{row.credit ? formatCurrency(row.credit) : <span className="text-slate-300">—</span>}</td><td className="px-5 py-3.5 text-right tabular-nums text-slate-600">{row.due ? <span className="text-amber-700">{formatCurrency(row.due)}</span> : <span className="text-slate-300">—</span>}</td><td className="px-6 py-3.5 text-right font-semibold tabular-nums text-slate-700">{formatCurrency(row.balance)}</td></tr>)}</tbody><tfoot><tr className="border-t border-slate-200 bg-slate-50/70 text-sm font-semibold"><td colSpan={2} className="px-6 py-4 text-slate-600">Year total</td><td className="px-5 py-4 text-right tabular-nums text-emerald-700">{formatCurrency(financials.paid)}</td><td className="px-5 py-4 text-right tabular-nums text-amber-700">{formatCurrency(financials.due)}</td><td className="px-6 py-4 text-right tabular-nums text-slate-800">{formatCurrency(financials.due)}</td></tr></tfoot></table></div>
        <div className="flex flex-col gap-1 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Statement generated from the member register.</span><span>Account no. {member.accountNumber}</span></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 p-5 sm:px-6"><h3 className="font-display text-base font-semibold text-slate-900">Payment receipts</h3><p className="mt-1 text-xs text-slate-400">Receipt details from the demo payment register for FY {year.replace("-", "–")}.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Method / status</th><th className="px-6 py-3">Receipt</th></tr></thead><tbody>{financials.payments.map((payment) => <tr key={payment.id} className="border-t border-slate-100 text-sm"><td className="px-6 py-3.5">{formatMemberDate(payment.date)}</td><td className="px-5 py-3.5">{payment.description}</td><td className="px-5 py-3.5 text-right font-semibold">{formatCurrency(payment.amount)}</td><td className="px-5 py-3.5">{payment.paymentMode} · {payment.status}</td><td className="px-6 py-3.5">{payment.receiptId || "—"}</td></tr>)}{financials.payments.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No payment receipts for this financial year.</td></tr>}</tbody></table></div>
      </section>
      {editing && <MemberFormModal member={member} onClose={() => setEditing(false)} onSave={(fields: MemberFields) => { onUpdate(member.id, fields); setEditing(false); }} />}
    </div>
  );
}
