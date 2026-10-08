import { useMemo, useState, type ClipboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import type { ManagedMember, YearWiseEntryFields } from "../data/memberManagement";
import { annualMembershipFee, formatCurrency, formatMemberDate, getMemberEntryYear, memberFinancials, toDateInput } from "../data/memberManagement";
import { financialYearForStartYear, formatFinancialYear, type MemberPayment } from "../services/registerService";

interface YearWiseListPageProps {
  members: ManagedMember[];
  payments: MemberPayment[];
  onCreate: (entries: YearWiseEntryFields[]) => void;
}

type SortOption = "latest" | "first" | "name-asc" | "name-desc" | "credit-high" | "credit-low";
type DraftField = "name" | "joinDate" | "amount";
type EntryDraft = { key: number; name: string; joinDate: string; amount: string };

let nextDraftKey = 0;

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Latest Entry" },
  { value: "first", label: "First Entry" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "credit-high", label: "Highest Credit" },
  { value: "credit-low", label: "Lowest Credit" },
];

function SearchIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function ArrowIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function createDraft(joinDate: string): EntryDraft {
  return { key: ++nextDraftKey, name: "", joinDate, amount: "" };
}

function normalizePastedDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const numericDate = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(trimmed);
  if (numericDate) {
    let day = Number(numericDate[1]);
    let month = Number(numericDate[2]);
    const year = Number(numericDate[3]);
    if (day <= 12 && month > 12) [day, month] = [month, day];
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return toDateInput(trimmed) || trimmed;
}

function normalizePastedAmount(value: string) {
  return value.trim().replace(/[^\d.-]/g, "");
}

export default function YearWiseListPage({ members, payments, onCreate }: YearWiseListPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [drafts, setDrafts] = useState<EntryDraft[] | null>(null);
  const [entryError, setEntryError] = useState("");

  const availableYears = useMemo(() => {
    const entryYears = members.map((member) => getMemberEntryYear(member.joinDate)).filter((year): year is number => year !== null);
    const now = new Date();
    const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return [...new Set([...entryYears, currentYear])].sort((a, b) => b - a);
  }, [members]);
  const mostRecentEntryYear = members.reduce<number | null>((latest, member) => {
    const year = getMemberEntryYear(member.joinDate);
    return year !== null && (latest === null || year > latest) ? year : latest;
  }, null);
  const requestedYear = Number(searchParams.get("year"));
  const now = new Date();
  const currentFinancialYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const selectedYear = availableYears.includes(requestedYear) ? requestedYear : mostRecentEntryYear ?? currentFinancialYearStart;

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return members
      .filter((member) => getMemberEntryYear(member.joinDate) === selectedYear && (!query || member.name.toLocaleLowerCase().includes(query)))
      .map((member) => ({ member, credit: memberFinancials(member, financialYearForStartYear(selectedYear), payments).paid, timestamp: new Date(member.joinDate).getTime() }))
      .sort((a, b) => {
        if (sortBy === "latest") return b.timestamp - a.timestamp;
        if (sortBy === "first") return a.timestamp - b.timestamp;
        if (sortBy === "name-asc") return a.member.name.localeCompare(b.member.name, undefined, { sensitivity: "base" });
        if (sortBy === "name-desc") return b.member.name.localeCompare(a.member.name, undefined, { sensitivity: "base" });
        if (sortBy === "credit-high") return b.credit - a.credit;
        return a.credit - b.credit;
      });
  }, [members, payments, search, selectedYear, sortBy]);

  function openMember(memberId: string) {
    navigate(`/member/${encodeURIComponent(memberId)}?year=${financialYearForStartYear(selectedYear)}`);
  }

  function exportYear() {
    const rows = filteredMembers.map(({ member, credit }) => ({
      "Financial year": financialYearForStartYear(selectedYear),
      "Member ID": member.id,
      Name: member.name,
      "Date joined": formatMemberDate(member.joinDate),
      "Recorded paid amount": credit,
      "Annual membership fee": annualMembershipFee,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Year-wise members");
    XLSX.writeFile(workbook, `members-${financialYearForStartYear(selectedYear)}.xlsx`);
  }

  function startQuickEntry() {
    setDrafts(Array.from({ length: 5 }, () => createDraft(initialEntryDate)));
    setEntryError("");
  }

  function updateDraft(rowIndex: number, field: DraftField, value: string) {
    setDrafts((current) => current?.map((draft, index) => index === rowIndex
      ? { ...draft, [field]: value }
      : draft) ?? null);
    setEntryError("");
  }

  function pasteCells(event: ClipboardEvent<Element>, startRow: number, startColumn: number) {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\t\r\n]/.test(text)) return;
    event.preventDefault();
    const fields: DraftField[] = ["name", "joinDate", "amount"];
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.at(-1) === "") lines.pop();
    const pastedRows = lines.map((line) => line.split("\t"));

    setDrafts((current) => {
      if (!current) return current;
      const updated = [...current];
      const requiredLength = startRow + pastedRows.length;
      while (updated.length < requiredLength) updated.push(createDraft(initialEntryDate));
      pastedRows.forEach((values, rowOffset) => {
        const rowIndex = startRow + rowOffset;
        values.forEach((rawValue, columnOffset) => {
          const field = fields[startColumn + columnOffset];
          if (!field) return;
          const value = field === "joinDate"
            ? normalizePastedDate(rawValue)
            : field === "amount"
              ? normalizePastedAmount(rawValue)
              : rawValue.trim();
          updated[rowIndex] = { ...updated[rowIndex], [field]: value };
        });
      });
      return updated;
    });
    setEntryError("");
  }

  function finishQuickEntry() {
    if (!drafts) return;
    const populated = drafts.filter((draft) => draft.name.trim() || draft.amount.trim());
    if (populated.length === 0) {
      setEntryError("Enter at least one member before finishing.");
      return;
    }
    const incomplete = populated.find((draft) => !draft.name.trim() || getMemberEntryYear(draft.joinDate) !== selectedYear || draft.amount.trim() === "" || !Number.isFinite(Number(draft.amount)) || Number(draft.amount) < 0);
    if (incomplete) {
      setEntryError(`Enter a name, an entry date in ${selectedYear}, and a valid amount.`);
      return;
    }
    onCreate(populated.map(({ name, joinDate, amount }) => ({
      name: name.trim(),
      joinDate: formatMemberDate(joinDate),
      amount: Number(amount),
    })));
    setDrafts(null);
    setEntryError("");
  }

  const isSearching = search.trim().length > 0;
  const initialEntryDate = selectedYear === currentFinancialYearStart
    ? new Date().toISOString().slice(0, 10)
    : `${selectedYear}-04-01`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400"><span>Members</span><span>/</span><span className="text-blue-600">Year Wise List</span></p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Year Wise List</h2>
          <p className="mt-2 text-sm text-slate-500">Browse member entries by the year they joined.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:mb-1">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span>Year</span>
            <span className="relative">
              <select aria-label="Select financial year" value={selectedYear} onChange={(event) => setSearchParams({ year: event.target.value })} className="form-control min-w-[138px] appearance-none pr-9 font-semibold text-slate-800">
                {availableYears.map((year) => <option key={year} value={year}>FY {formatFinancialYear(financialYearForStartYear(year))}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </span>
          </label>
          {drafts === null
            ? <><button onClick={exportYear} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Export FY list</button><button onClick={startQuickEntry} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add entry</button></>
            : <button onClick={() => { setDrafts(null); setEntryError(""); }} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h3 className="font-display text-base font-semibold text-slate-900">Member entries <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-xs font-semibold text-slate-500">{filteredMembers.length}</span></h3><p className="mt-1 text-xs text-slate-400">Entries recorded in FY {formatFinancialYear(financialYearForStartYear(selectedYear))} · Membership fee {formatCurrency(annualMembershipFee)}</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block sm:w-72"><span className="sr-only">Search member by name</span><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member by name..." className="form-control pl-10" /></label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className="hidden sm:inline">Sort by</span><select aria-label="Sort member entries" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="form-control min-w-[160px]"><optgroup label="Sort by">{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup></select></label>
          </div>
        </div>

        {drafts !== null ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div><h4 className="font-display text-sm font-semibold text-slate-800">Quick entry</h4><p className="mt-1 text-xs text-slate-400">{drafts.filter((draft) => draft.name || draft.amount).length} rows ready</p></div>
            <button onClick={() => setDrafts((current) => current ? [...current, createDraft(initialEntryDate)] : current)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead><tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"><th className="w-12 px-4 py-3 text-right">#</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Date of entry</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
              <tbody>{drafts.map((draft, rowIndex) => {
                const cellClass = "h-10 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100";
                return <tr key={draft.key} className="border-t border-slate-100 hover:bg-slate-50/60"><td className="px-4 py-2 text-right text-xs tabular-nums text-slate-400">{String(rowIndex + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-1.5"><input aria-label={`Row ${rowIndex + 1} name`} autoFocus={rowIndex === 0} value={draft.name} onChange={(event) => updateDraft(rowIndex, "name", event.target.value)} onPaste={(event) => pasteCells(event, rowIndex, 0)} placeholder="Member name" className={cellClass} /></td>
                  <td className="px-3 py-1.5"><input aria-label={`Row ${rowIndex + 1} date of entry`} type="date" value={draft.joinDate} onChange={(event) => updateDraft(rowIndex, "joinDate", event.target.value)} onPaste={(event) => pasteCells(event, rowIndex, 1)} className={cellClass} /></td>
                  <td className="px-3 py-1.5"><input aria-label={`Row ${rowIndex + 1} amount`} type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => updateDraft(rowIndex, "amount", event.target.value)} onPaste={(event) => pasteCells(event, rowIndex, 2)} placeholder="0.00" className={`${cellClass} text-right tabular-nums`} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p role="status" className="min-h-5 text-sm text-rose-600">{entryError}</p>
            <button onClick={finishQuickEntry} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Done</button>
          </div>
        </> : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead><tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400"><th scope="col" className="px-6 py-3.5">Member name</th><th scope="col" className="px-5 py-3.5">Date of entry</th><th scope="col" className="px-5 py-3.5 text-right">Amount of credit</th><th scope="col" className="px-6 py-3.5 text-right">Action</th></tr></thead>
            <tbody>
              {filteredMembers.map(({ member, credit }) => (
                <tr key={member.id} className="group border-t border-slate-100 text-sm transition-colors hover:bg-blue-50/50">
                  <td className="px-6 py-4"><button onClick={() => openMember(member.id)} className="flex items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: member.avatarColor }}>{member.initials}</span><span><span className="block font-semibold text-slate-800 group-hover:text-blue-700">{member.name}</span><span className="mt-0.5 block text-xs text-slate-400">{member.id}</span></span></button></td>
                  <td className="px-5 py-4 text-slate-600">{formatMemberDate(member.joinDate)}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-800">{formatCurrency(credit)}</td>
                  <td className="px-6 py-4 text-right"><button onClick={() => openMember(member.id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View <ArrowIcon /></button></td>
                </tr>
              ))}
              {filteredMembers.length === 0 && <tr><td colSpan={4} className="px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><SearchIcon /></div><p className="mt-3 text-sm font-semibold text-slate-700">{isSearching ? "No members match your search." : "No members found for this year."}</p><p className="mt-1 text-sm text-slate-400">{isSearching ? "Try another name or clear your search." : `There are no entries recorded for ${selectedYear}.`}</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 text-xs text-slate-400"><span>Showing <span className="font-semibold text-slate-600">{filteredMembers.length}</span> of <span className="font-semibold text-slate-600">{members.filter((member) => getMemberEntryYear(member.joinDate) === selectedYear).length}</span> entries</span><span className="hidden sm:inline">Select a member to view their passbook</span></div>
        </>}
      </section>
    </div>
  );
}