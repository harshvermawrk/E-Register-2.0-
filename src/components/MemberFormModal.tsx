import { useEffect, useState, type FormEvent } from "react";
import type { ManagedMember, MemberFields } from "../data/memberManagement";
import { formatMemberDate, toDateInput } from "../data/memberManagement";

interface MemberFormModalProps {
  member: ManagedMember | null;
  initialJoinDate?: string;
  onClose: () => void;
  onSave: (fields: MemberFields) => void;
}

export default function MemberFormModal({ member, initialJoinDate, onClose, onSave }: MemberFormModalProps) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [joinDate, setJoinDate] = useState("");

  useEffect(() => {
    setName(member?.name ?? "");
    setCity(member?.hometown ?? "");
    setPhone(member?.phone ?? "");
    setJoinDate(member ? toDateInput(member.joinDate) : initialJoinDate ?? new Date().toISOString().slice(0, 10));
  }, [initialJoinDate, member]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !city.trim() || !/^[+()\d\s-]{7,20}$/.test(phone.trim()) || !toDateInput(joinDate)) return;
    onSave({ name: name.trim(), hometown: city.trim(), phone: phone.trim(), joinDate: formatMemberDate(joinDate), status: member?.status ?? "Active" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="member-form-title" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">Member directory</p>
            <h2 id="member-form-title" className="mt-1 font-display text-xl font-semibold text-slate-900">{member ? "Edit member" : "Add a member"}</h2>
            <p className="mt-1 text-sm text-slate-500">Keep member contact and account details up to date.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close form">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 6-12 12M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {!member && <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">A member ID and account number will be assigned automatically.</div>}
          <label className="block text-sm font-medium text-slate-700">Full name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Asha Kapoor" className="form-control mt-1.5" /></label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">City<input required value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="form-control mt-1.5" /></label>
            <label className="block text-sm font-medium text-slate-700">Phone<input required type="tel" pattern="[+()0-9 -]{7,20}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" className="form-control mt-1.5" /></label>
            <label className="block text-sm font-medium text-slate-700">Join date<input required type="date" value={joinDate} onChange={(event) => setJoinDate(event.target.value)} className="form-control mt-1.5" /></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{member ? "Save changes" : "Add member"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
