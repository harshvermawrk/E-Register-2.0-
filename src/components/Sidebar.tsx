interface SidebarProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "members",
    label: "Member",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "year-wise-list",
    label: "Batwaara",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "expenses-collection",
    label: "Expenses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: "collections",
    label: "Collections",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h5M8 16h8" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeNav, onNavChange, collapsed, onToggle }: SidebarProps) {
  return (
    <div
      className="relative flex flex-col h-full transition-all duration-300 ease-in-out shrink-0"
      style={{
        width: collapsed ? "72px" : "240px",
        backgroundColor: "var(--color-warm-white)",
        borderRight: "1px solid var(--color-warm-border)",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[84px] z-10 w-6 h-6 rounded-full flex items-center justify-center border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors focus-ring"
        style={{ color: "var(--color-dark-brown)" }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s" }}
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "rgba(212,160,23,0.4)", height: "72px" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--color-deep-red)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[10px] font-semibold tracking-wide text-deep-red">Shree Ranjeet Kuvar Baba</span>
            <span className="mt-0.5 block text-sm font-semibold tracking-tight text-dark-brown">E-Register</span>
          </div>
        )}
      </div>

      {/* Nav label */}
      {!collapsed && (
        <p className="px-5 pt-6 pb-2 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--color-muted-brown)" }}>
          Main Menu
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 pt-2 space-y-1 overflow-y-auto" aria-label="Main menu">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className="nav-item focus-ring w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left"
              style={{
                backgroundColor: isActive ? "var(--color-saffron)" : "transparent",
                color: isActive ? "var(--color-dark-brown)" : "var(--color-muted-brown)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(232,117,26,0.08)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
