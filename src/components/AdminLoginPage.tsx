import { useRef, useState, type FormEvent } from "react";

export type AuthView = "login" | "forgot-password" | "reset-password";

interface AdminLoginPageProps {
  view?: AuthView;
  onSignIn: (email: string, password: string) => Promise<void>;
  onRequestReset?: (email: string) => Promise<void>;
  onResetPassword?: (password: string) => Promise<void>;
  defaultEmail?: string;
  onForgotPassword?: () => void;
  onBackToLogin?: () => void;
}

export default function AdminLoginPage({
  view = "login",
  onSignIn,
  onRequestReset,
  onResetPassword,
  defaultEmail = "",
  onForgotPassword,
  onBackToLogin,
}: AdminLoginPageProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const loginInProgress = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginInProgress.current) return;
    setError("");
    setSuccess("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your admin email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    loginInProgress.current = true;
    setBusy(true);
    try {
      await onSignIn(trimmedEmail, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
    } finally {
      loginInProgress.current = false;
      setBusy(false);
    }
  }

  async function submitResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!onRequestReset) {
      setError("Password reset is unavailable right now.");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter the admin email address associated with the account.");
      return;
    }
    setBusy(true);
    try {
      await onRequestReset(trimmedEmail);
      setSuccess("A secure reset link has been sent to this email address. Check your inbox and return here once you have set a new password.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reset email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!onResetPassword) {
      setError("A valid recovery session is required before changing the password.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two password entries do not match.");
      return;
    }
    setBusy(true);
    try {
      await onResetPassword(password);
      setSuccess("Password updated successfully. You can sign in with your new password.");
      if (onBackToLogin) {
        window.setTimeout(() => onBackToLogin(), 1200);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The password reset could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    view === "forgot-password"
      ? "Reset password"
      : view === "reset-password"
        ? "Create a new password"
        : "Administrator sign in";

  const subtitle =
    view === "forgot-password"
      ? "Enter the admin email and we will send a secure reset link."
      : view === "reset-password"
        ? "Use the secure email link to create a new password for the admin account."
        : "Sign in with the admin account approved for this test project.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_70px_rgba(15,23,42,0.09)] sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20" aria-hidden="true">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6" /></svg>
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">E-Register test workspace</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>

        {view === "login" && (
          <form noValidate onSubmit={submitLogin} className="mt-7 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email address
              <input autoComplete="username" type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} className="form-control mt-1.5" placeholder="admin@example.com" />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1.5">
                <input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} className="form-control w-full pr-11" placeholder="Enter your password" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-700">{showPassword ? "Hide" : "Show"}</button>
              </div>
            </label>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-700">{success}</p>}

            <button disabled={busy} type="submit" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <button type="button" onClick={() => onForgotPassword?.()} className="w-full text-center text-sm font-medium text-blue-600 transition hover:text-blue-700">
              Forgot password?
            </button>
          </form>
        )}

        {view === "forgot-password" && (
          <form onSubmit={submitResetRequest} className="mt-7 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Admin email address
              <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="form-control mt-1.5" placeholder="admin@example.com" />
            </label>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-700">{success}</p>}

            <button disabled={busy || !email.trim()} type="submit" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Sending link…" : "Send reset link"}
            </button>

            <button type="button" onClick={() => onBackToLogin?.()} className="w-full text-center text-sm font-medium text-slate-600 transition hover:text-slate-800">
              Back to login
            </button>
          </form>
        )}

        {view === "reset-password" && (
          <form onSubmit={submitPasswordReset} className="mt-7 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              New password
              <div className="relative mt-1.5">
                <input autoComplete="new-password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="form-control w-full pr-11" placeholder="Create a new password" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-700">{showPassword ? "Hide" : "Show"}</button>
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Confirm password
              <div className="relative mt-1.5">
                <input autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="form-control w-full pr-11" placeholder="Repeat your new password" />
                <button type="button" aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} onClick={() => setShowConfirmPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-700">{showConfirmPassword ? "Hide" : "Show"}</button>
              </div>
            </label>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-700">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-5 text-emerald-700">{success}</p>}

            <button disabled={busy || !password || !confirmPassword} type="submit" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Saving password…" : "Save new password"}
            </button>

            <button type="button" onClick={() => onBackToLogin?.()} className="w-full text-center text-sm font-medium text-slate-600 transition hover:text-slate-800">
              Back to login
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">Only the project’s approved admin account can access this register.</p>
      </section>
    </main>
  );
}
