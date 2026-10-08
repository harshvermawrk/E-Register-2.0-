interface TopNavbarProps {
  pageTitle: string;
  sidebarCollapsed: boolean;
  dataMode?: "local-sample" | "cloud-test";
  accountEmail?: string;
  onSignOut?: () => void;
}

export default function TopNavbar({ pageTitle, sidebarCollapsed, dataMode = "local-sample", accountEmail, onSignOut }: TopNavbarProps) {
  return (
    <div
      className="flex items-center justify-between px-3 sm:px-6 shrink-0 z-20"
      style={{
        height: "72px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Breadcrumb (doubles as the page title, so nothing overlaps the center of the bar) */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="navbar-home" style={{ color: "#94A3B8" }}>Home</span>
          <svg className="navbar-breadcrumb-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h1
            className="text-sm font-semibold truncate"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#0F172A" }}
          >
            {pageTitle}
          </h1>
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-3">
        <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 sm:inline-flex">
          {dataMode === "cloud-test" ? "Cloud test · sample data" : "Local sample data"}
        </span>
        {/* Admin Profile Avatar */}
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: "#0F172A" }}
          >
            AD
          </div>
          <div className="navbar-account-copy text-left">
            <p className="max-w-[150px] truncate text-sm font-medium" style={{ color: "#0F172A", lineHeight: "1.2" }}>{accountEmail || "Admin"}</p>
            <p className="text-xs" style={{ color: "#94A3B8", lineHeight: "1.2" }}>{dataMode === "cloud-test" ? "Test administrator" : "Local demo"}</p>
          </div>
        </div>
        {onSignOut && <button type="button" onClick={onSignOut} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">Sign out</button>}
      </div>

    </div>
  );
}
