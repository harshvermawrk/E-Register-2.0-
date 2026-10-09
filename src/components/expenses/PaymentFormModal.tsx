import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ManagedMember } from "../../data/memberManagement";
import { dateToFinancialYear, type PaymentFields, type PaymentMode, type PaymentStatus } from "../../services/registerService";

interface PaymentFormModalProps {
  members: ManagedMember[];
  year: string;
  cloudMode?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (payment: PaymentFields) => Promise<void>;
}

function isValidRegisterDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return parsed.getFullYear() === Number(year)
    && parsed.getMonth() === Number(month) - 1
    && parsed.getDate() === Number(day);
}

export default function PaymentFormModal({ members, year, cloudMode = false, saving = false, onClose, onSave }: PaymentFormModalProps) {
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(`${year.slice(0, 4)}-04-01`);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [status, setStatus] = useState<PaymentStatus>("Paid");
  const [receiptId, setReceiptId] = useState("");
  const [description, setDescription] = useState("Membership contribution");
  const [error, setError] = useState("");
  const submitLock = useRef(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || saving) return;
    const value = Number(amount);
    if (!memberId || !members.some((member) => member.id === memberId)) return setError("Select a member.");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (!isValidRegisterDate(date) || dateToFinancialYear(date) !== year) return setError(`Enter a payment date within FY ${year.replace("-", "–")} (April–March).`);

    submitLock.current = true;
    setError("");
    try {
      await onSave({
        memberId,
        date,
        amount: value,
        paymentMode,
        status,
        receiptId: receiptId.trim() || `RCP-${date.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        description: description.trim() || "Member contribution",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The collection could not be saved. Please try again.");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="payment-form-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Member collection · FY {year.replace("-", "–")}</p><h2 id="payment-form-title" className="mt-1 font-display text-xl font-semibold text-slate-900">Record member payment</h2><p className="mt-1 text-sm text-slate-500">{cloudMode ? "The record will be saved to the cloud test register." : "The record will be saved in this browser."}</p></div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close payment form" className="focus-ring rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 disabled:opacity-50">×</button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Member</span><select autoFocus value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-invalid={Boolean(error && !memberId)} className="form-control"><option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</select></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="form-control" /></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-control" placeholder="0.00" /></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</span><select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)} className="form-control"><option>UPI</option><option>Cash</option><option>Bank Transfer</option><option>Cheque</option></select></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)} className="form-control"><option>Paid</option><option>Pending</option><option>Failed</option></select></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Receipt number <span className="font-normal text-slate-400">(optional)</span></span><input value={receiptId} onChange={(event) => setReceiptId(event.target.value)} className="form-control" placeholder="Auto-generated if empty" /></label>
          <label><span className="mb-1.5 block text-sm font-medium text-slate-700">Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} className="form-control" /></label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className="action-button border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving} className="action-button border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save payment"}</button></footer>
      </form>
    </div>
  );
}
