import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import ExpenseCollectionPage from "./components/expenses/ExpenseCollectionPage";
import AdminLoginPage from "./components/AdminLoginPage";
import MemberProfilePage from "./components/MemberProfilePage";
import MembersListPage from "./components/MembersListPage";
import YearWiseListPage from "./components/YearWiseListPage";
import { createManagedMember, formatCurrency, initialManagedMembers, type ManagedMember, type MemberFields, type YearWiseEntryFields } from "./data/memberManagement";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { initialExpenses, loadExpenses, type ExpenseRecord } from "./services/expenseService";
import { createPayment, financialYears, loadPayments, monthlyPaymentTotals, paymentTotals, savePayments, type MemberPayment, type PaymentFields } from "./services/registerService";
import { archiveCloudMember, createCloudMember, createCloudMembers, createCloudPayment, loadCloudRegister, syncCloudExpenses, updateCloudMember } from "./services/cloudRegister";
import { isSupabaseConfigured, requireSupabase, signInAdmin, signOutAdmin, verifyAdminAccess } from "./services/supabaseClient";

function DashboardHome({ onNavigate, members, payments, expenses }: { onNavigate: (nav: string) => void; members: ManagedMember[]; payments: MemberPayment[]; expenses: ExpenseRecord[] }) {
  const [year, setYear] = useState<string>(financialYears[0]);
  const totals = paymentTotals(payments, year);
  const expenseTotal = expenses.filter((expense) => expense.year === Number(year.slice(0, 4)) && (expense.status ?? "Paid") === "Paid").reduce((sum, expense) => sum + expense.amount, 0);
  const chartData = monthlyPaymentTotals(payments, year);
  const activeMembers = members.filter((member) => member.status === "Active").length;
  const cards = [
    { label: "Members", value: members.length.toLocaleString("en-IN"), note: `${activeMembers} active · ${members.filter((member) => member.status === "Pending").length} pending` },
    { label: "Collections received", value: formatCurrency(totals.collected), note: `Paid member receipts · FY ${year.replace("-", "–")}` },
    { label: "Pending collections", value: formatCurrency(totals.pending), note: "Awaiting payment status update" },
    { label: "Net finance balance", value: formatCurrency(totals.collected - expenseTotal), note: `${formatCurrency(expenseTotal)} paid expenses this year` },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-5 py-7 sm:px-8 lg:px-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">Workspace</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Welcome to E-Register</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Choose a workspace to manage your member register, review yearly entries, or keep track of society expenses and collections.</p>
      </header>
      <section aria-label="Quick access" className="grid gap-4 md:grid-cols-3">
        {[
          { id: "members", title: "Members", description: "Manage member details and passbooks.", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
          { id: "year-wise-list", title: "Year Wise List", description: "Browse and add member entries by year.", icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" },
          { id: "expenses-collection", title: "Expenses & Collection", description: "Review yearly collections and period expenses.", icon: "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
        ].map((item) => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.id)} className="group rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-ring sm:p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
            </span>
            <span className="mt-5 block font-display text-base font-semibold text-slate-900">{item.title}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-blue-600">Open section <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </section>
      <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <article key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.035)]"><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-2 font-display text-2xl font-semibold text-slate-900">{card.value}</p><p className="mt-2 text-xs text-slate-400">{card.note}</p></article>)}
      </section>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.035)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-display text-base font-semibold text-slate-900">Collection trend</h3><p className="mt-1 text-sm text-slate-500">Paid member receipts recorded in each month.</p></div><label className="text-xs font-semibold text-slate-500">Financial year<select value={year} onChange={(event) => setYear(event.target.value)} className="form-control mt-1 min-w-[150px]">{financialYears.map((item) => <option key={item} value={item}>FY {item.replace("-", "–")}</option>)}</select></label></div>
        {payments.some((payment) => payment.status === "Paid" && paymentTotals(payments, year).collected > 0) ? <ResponsiveContainer width="100%" height={260}><AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}><defs><linearGradient id="dashboardCollection" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.24} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={56} /><Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} /><Area type="monotone" dataKey="amount" name="Paid collections" stroke="#2563EB" fill="url(#dashboardCollection)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="rounded-xl bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">No paid collections recorded for FY {year.replace("-", "–")} yet.</div>}
        <p className="mt-3 text-xs text-slate-400">Demo register · summaries and chart use the member and payment records shown in this app.</p>
      </section>
    </div>
  );
}

function DashboardApp({ cloudMode, adminEmail, onSignOut }: { cloudMode: boolean; adminEmail?: string; onSignOut?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 900);
  const [members, setMembers] = useState<ManagedMember[]>(() => {
    if (cloudMode) return [];
    try {
      const savedMembers = window.localStorage.getItem("e-register.members.v1");
      if (savedMembers) {
        const parsedMembers: unknown = JSON.parse(savedMembers);
        if (Array.isArray(parsedMembers)) return parsedMembers as ManagedMember[];
      }
    } catch {
      // Fall back to the sample register if browser storage is unavailable or invalid.
    }
    return initialManagedMembers;
  });
  const [payments, setPayments] = useState<MemberPayment[]>(() => {
    if (cloudMode) return [];
    try {
      return loadPayments();
    } catch {
      return [];
    }
  });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    if (cloudMode) return [];
    try {
      return loadExpenses();
    } catch {
      return initialExpenses;
    }
  });
  const [dataLoaded, setDataLoaded] = useState(!cloudMode);
  const [dataLoadError, setDataLoadError] = useState("");
  const [dataNotice, setDataNotice] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const updateExpenses = useCallback((next: ExpenseRecord[]) => setExpenses(next), []);
  const persistCloudExpenses = useCallback((next: ExpenseRecord[]) => syncCloudExpenses(next), []);

  useEffect(() => {
    if (!cloudMode) return;
    let active = true;
    setDataLoaded(false);
    setDataLoadError("");
    loadCloudRegister()
      .then((data) => {
        if (!active) return;
        setMembers(data.members);
        setPayments(data.payments);
        setExpenses(data.expenses);
        setDataLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDataLoadError(error instanceof Error ? error.message : "Cloud test data could not be loaded.");
        setDataLoaded(true);
      });
    return () => { active = false; };
  }, [cloudMode, loadRevision]);

  useEffect(() => {
    if (cloudMode) return;
    try {
      window.localStorage.setItem("e-register.members.v1", JSON.stringify(members));
    } catch {
      // The register continues to work for this session if storage is unavailable.
    }
  }, [members, cloudMode]);
  useEffect(() => {
    if (cloudMode) return;
    try {
      savePayments(payments);
    } catch {
      // Payment changes remain available for this session when browser storage is unavailable.
    }
  }, [payments, cloudMode]);

  useEffect(() => {
    function collapseForNarrowScreen() {
      if (window.innerWidth < 760) setSidebarCollapsed(true);
    }
    window.addEventListener("resize", collapseForNarrowScreen);
    return () => window.removeEventListener("resize", collapseForNarrowScreen);
  }, []);
  const segments = location.pathname.split("/").filter(Boolean);
  const activeNav = segments[0] === "member" ? "year-wise-list" : segments[0] || "dashboard";
  const selectedMember = (segments[0] === "members" || segments[0] === "member") && segments[1]
    ? members.find((member) => member.id.toLowerCase() === decodeURIComponent(segments[1]).toLowerCase())
    : undefined;
  const pageTitle = selectedMember ? `${selectedMember.name} · Profile` : ({
    dashboard: "Dashboard",
    members: "Members",
    "year-wise-list": "Year Wise List",
    "expenses-collection": "Expenses & Collection",
  } as Record<string, string>)[activeNav] ?? "Dashboard";

  function navigateTo(nav: string) {
    navigate(nav === "members" ? "/members" : `/${nav}`);
  }

  function createMember(fields: MemberFields) {
    const sno = Math.max(0, ...members.map((member) => member.sno)) + 1;
    const member = createManagedMember(fields, sno);
    runChange(() => createCloudMember(member), () => setMembers((current) => [...current, member]));
  }

  function createMembers(entries: YearWiseEntryFields[]) {
    const firstSno = Math.max(0, ...members.map((member) => member.sno)) + 1;
    const created = entries.map((entry, index) => createManagedMember({
        name: entry.name,
        hometown: "",
        phone: "",
        joinDate: entry.joinDate,
        status: "Active",
      }, firstSno + index, entry.amount));
    const nextPayments = created.reduce((result, member) => member.entryAmount && member.entryAmount > 0
        ? createPayment(result, { memberId: member.id, date: member.joinDate, amount: member.entryAmount, paymentMode: "Cash", status: "Paid", receiptId: `RCP-${member.id}`, description: "Member entry credit" })
        : result, payments);
    const addedPayments = nextPayments.slice(payments.length);
    runChange(() => createCloudMembers(created, addedPayments), () => {
      setMembers((current) => [...current, ...created]);
      setPayments(nextPayments);
    });
  }

  function recordPayment(fields: PaymentFields) {
    const payment = createPayment([], fields)[0];
    runChange(() => createCloudPayment(payment), () => setPayments((current) => [...current, payment]));
  }

  function updateMember(id: string, fields: MemberFields) {
    const existing = members.find((member) => member.id === id);
    if (!existing) return;
    const updated = { ...existing, ...fields, initials: fields.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") };
    runChange(() => updateCloudMember(updated), () => setMembers((current) => current.map((member) => member.id === id ? updated : member)));
  }

  function deleteMember(id: string) {
    runChange(() => archiveCloudMember(id), () => setMembers((current) => current.filter((member) => member.id !== id)));
  }

  function runChange(saveToCloud: () => Promise<void>, applyChange: () => void) {
    if (!cloudMode) {
      applyChange();
      return;
    }
    setDataNotice("");
    void saveToCloud()
      .then(applyChange)
      .catch((error: unknown) => setDataNotice(error instanceof Error ? error.message : "The change could not be saved to the cloud test database."));
  }

  if (cloudMode && !dataLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><div className="rounded-2xl border border-slate-200 bg-white px-7 py-6 text-center shadow-sm"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" /><p className="mt-4 text-sm font-medium text-slate-700">Loading the cloud test register…</p></div></div>;
  }

  if (cloudMode && dataLoadError) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">E-Register test workspace</p><h1 className="mt-2 text-xl font-semibold text-slate-900">Couldn’t load the cloud register</h1><p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{dataLoadError}</p><div className="mt-5 flex gap-3"><button type="button" onClick={() => setLoadRevision((revision) => revision + 1)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Try again</button><button type="button" onClick={onSignOut} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Sign out</button></div></section></main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div id="dashboard-sidebar" className="h-full shrink-0">
        <Sidebar activeNav={activeNav} onNavChange={navigateTo} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div id="dashboard-navbar" className="shrink-0"><TopNavbar pageTitle={pageTitle} sidebarCollapsed={sidebarCollapsed} dataMode={cloudMode ? "cloud-test" : "local-sample"} accountEmail={adminEmail} onSignOut={onSignOut} /></div>
        <main id="main-content" className="min-h-0 flex-1 overflow-hidden bg-slate-50">
          <div className="h-full overflow-y-auto">
            {dataNotice && <div role="alert" className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-8 lg:mx-10"><span>{dataNotice}</span><button type="button" onClick={() => setDataNotice("")} aria-label="Dismiss message" className="focus-ring rounded px-1 font-semibold">×</button></div>}
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/members" element={<MembersListPage members={members} onCreate={createMember} onUpdate={updateMember} onDelete={deleteMember} />} />
              <Route path="/members/:memberId" element={<MemberProfilePage members={members} payments={payments} onUpdate={updateMember} onDelete={deleteMember} />} />
              <Route path="/year-wise-list" element={<YearWiseListPage members={members} payments={payments} onCreate={createMembers} />} />
              <Route path="/member/:memberId" element={<MemberProfilePage members={members} payments={payments} onUpdate={updateMember} onDelete={deleteMember} backToYearWise />} />
              <Route path="/dashboard" element={<DashboardHome onNavigate={navigateTo} members={members} payments={payments} expenses={expenses} />} />
              <Route path="/expenses-collection" element={<ExpenseCollectionPage members={members} payments={payments} onCreatePayment={recordPayment} onExpensesChange={updateExpenses} savedExpenses={expenses} cloudMode={cloudMode} onSaveCloudExpenses={persistCloudExpenses} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function AdminAppGate() {
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const client = requireSupabase();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) setAdminEmail("");
    });
    client.auth.getSession().then(async ({ data, error }) => {
      if (error) throw error;
      if (data.session?.user) {
        await verifyAdminAccess();
        if (active) setAdminEmail(data.session.user.email ?? "Admin");
      }
    }).catch(async () => {
      await client.auth.signOut();
    }).finally(() => {
      if (active) setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) return <DashboardApp cloudMode={false} />;
  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-label="Checking admin session" /></div>;

  if (!adminEmail) {
    return <AdminLoginPage onSignIn={async (email, password) => {
      const user = await signInAdmin(email, password);
      setAdminEmail(user.email ?? "Admin");
    }} />;
  }

  return <DashboardApp cloudMode adminEmail={adminEmail} onSignOut={() => {
    void signOutAdmin().catch((error: unknown) => console.error("E-Register sign-out failed.", error)).finally(() => setAdminEmail(""));
  }} />;
}

export default function App() {
  const Router = window.desktop ? HashRouter : BrowserRouter;
  return <Router><AdminAppGate /></Router>;
}
