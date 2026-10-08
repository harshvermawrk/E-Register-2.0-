import { useState, type FormEvent } from "react";

interface AdminLoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export default function AdminLoginPage({ onSignIn }: AdminLoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_70px_rgba(15,23,42,0.09)] sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20" aria-hidden="true">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6" /></svg>
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">E-Register test workspace</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Administrator sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the admin account approved for this test project.</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="form-control mt-1.5" placeholder="admin@example.com" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="form-control mt-1.5" placeholder="Enter your password" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">{error}</p>}
          <button disabled={busy} type="submit" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-slate-400">Only the project’s approved admin account can access this register.</p>
      </section>
    </main>
  );
}
