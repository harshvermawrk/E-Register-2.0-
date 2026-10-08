import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import type { ManagedMember, MemberFields } from "../data/memberManagement";
import MemberFormModal from "./MemberFormModal";

interface MembersListPageProps {
  members: ManagedMember[];
  onCreate: (fields: MemberFields) => void;
  onUpdate: (id: string, fields: MemberFields) => void;
  onDelete: (id: string) => void;
}

type SortField = "name" | "hometown" | "joinDate" | "id";

function Icon({ kind }: { kind: "search" | "download" | "plus" | "edit" | "delete" | "arrow" }) {
  const paths: Record<typeof kind, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></>,
    delete: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export default function MembersListPage({ members, onCreate, onUpdate, onDelete }: MembersListPageProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedMember | null>(null);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return members
      .filter((member) => !query || [member.name, member.id, member.phone, member.email, member.hometown, member.accountNumber]
        .some((value) => value.toLocaleLowerCase().includes(query)))
      .sort((a, b) => sortBy === "joinDate"
        ? new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()
        : a[sortBy].localeCompare(b[sortBy], undefined, { numeric: true }));
  }, [members, search, sortBy]);

  function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(filteredMembers.map((member) => ({
      "Member ID": member.id,
      Name: member.name,
      City: member.hometown,
      Phone: member.phone,
      Email: member.email,
      "Join Date": member.joinDate,
      "Account Number": member.accountNumber,
    })));
    worksheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
    XLSX.writeFile(workbook, "member-register.xlsx");
  }

  function saveMember(fields: MemberFields) {
    if (editing) onUpdate(editing.id, fields);
    else onCreate(fields);
    setFormOpen(false);
    setEditing(null);
  }

  function deleteMember(member: ManagedMember) {
    if (window.confirm(`Delete ${member.name} from the member register?`)) onDelete(member.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 sm:px-8 lg:px-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400"><span>Directory</span><span>/</span><span className="text-blue-600">Members</span></div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Member management</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-500">Keep your community organized and every member account within reach.</p>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
          <Icon kind="plus" /> Add member
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="grid min-w-0 gap-4 border-b border-slate-100 p-5 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-center">
          <div className="min-w-0"><h3 className="font-display text-base font-semibold text-slate-900">All members <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-xs font-semibold text-slate-500">{filteredMembers.length}</span></h3><p className="mt-1 text-xs text-slate-400">Search and manage your member register</p></div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,145px)_auto] sm:items-center lg:grid-cols-[minmax(0,1fr)_200px_auto]">
            <div className="relative col-span-2 min-w-0 sm:col-span-1">
              <label htmlFor="member-search" className="sr-only">Search members by name, ID, phone, email, city, or account number</label>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Icon kind="search" /></span>
              <input id="member-search" type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, phone, email, city..." className="form-control member-list-search-input bg-slate-50 text-sm shadow-sm focus:bg-white" />
              {search && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 text-xl leading-none text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">×</button>}
            </div>
            <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500"><span className="sr-only">Sort members</span><span className="hidden lg:inline">Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortField)} className="form-control min-w-0"><option value="name">Name (A–Z)</option><option value="hometown">City</option><option value="joinDate">Join date</option><option value="id">Member ID</option></select></label>
            <button onClick={exportExcel} className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"><Icon kind="download" /><span className="sm:hidden">Export</span><span className="hidden sm:inline">Export Excel</span></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead><tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400"><th className="w-20 px-6 py-3.5">S.No</th><th className="px-5 py-3.5">Name</th><th className="px-5 py-3.5">City</th><th className="px-5 py-3.5">Phone</th><th className="px-6 py-3.5 text-right">Actions</th></tr></thead>
            <tbody>
              {filteredMembers.map((member, index) => (
                <tr key={member.id} tabIndex={0} role="link" aria-label={`Open profile for ${member.name}`} onClick={() => navigate(`/members/${encodeURIComponent(member.id)}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/members/${encodeURIComponent(member.id)}`); } }} className="group cursor-pointer border-t border-slate-100 text-sm transition-colors hover:bg-blue-50/60 focus-visible:bg-blue-50/60 focus-visible:outline-none">
                  <td className="px-6 py-4 text-sm tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white shadow-sm" style={{ background: member.avatarColor }}>{member.initials}</div><div className="min-w-0"><p className="font-semibold text-slate-800 group-hover:text-blue-700">{member.name}</p><p className="mt-0.5 text-xs text-slate-400">{member.id}</p></div></div></td>
                  <td className="px-5 py-4 text-slate-600">{member.hometown}</td>
                  <td className="px-5 py-4 text-slate-600">{member.phone}</td>
                  <td className="px-6 py-4"><div className="flex items-center justify-end gap-1 opacity-70 transition group-hover:opacity-100 group-focus-within:opacity-100"><button aria-label={`Edit ${member.name}`} title="Edit member" onClick={(event) => { event.stopPropagation(); setEditing(member); setFormOpen(true); }} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-blue-600"><Icon kind="edit" /></button><button aria-label={`Delete ${member.name}`} title="Delete member" onClick={(event) => { event.stopPropagation(); deleteMember(member); }} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600"><Icon kind="delete" /></button></div></td>
                </tr>
              ))}
              {filteredMembers.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon kind="search" /></div><p className="mt-3 text-sm font-semibold text-slate-700">No members found</p><p className="mt-1 text-sm text-slate-400">Try another name, ID, phone, email, city, or account number.</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 text-xs text-slate-400"><span>Showing <span className="font-semibold text-slate-600">{filteredMembers.length}</span> of <span className="font-semibold text-slate-600">{members.length}</span> members</span><span className="hidden items-center gap-1 text-slate-400 sm:flex">Select a row to view the passbook <span className="text-blue-500"><Icon kind="arrow" /></span></span></div>
      </section>

      {formOpen && <MemberFormModal member={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={saveMember} />}
    </div>
  );
}
